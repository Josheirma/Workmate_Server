// src/middleware/idempotency.ts
//
// PURPOSE
// -------
// Prevent the same PayPal capture-order request from being processed
// more than once.
//
// The key we use is the PayPal orderID.
//
// Example:
//
//   POST /api/paypal/capture-order
//   {
//     orderID: "5O190127TN364715T"
//   }
//
// The first request creates:
//
//   key = "5O190127TN364715T"
//   status = "pending"
//
// If the browser/client sends the same request again, the INSERT
// violates the UNIQUE constraint on idempotency_keys.key.
//
// We then look at the existing row:
//
//   complete -> return the previously cached response
//   failed   -> return the previously cached response
//   pending  -> another request is still processing it
//
// This protects the PayPal capture route from duplicate processing
// caused by retries, double-clicks, network retries, etc.
//

import { Request, Response, NextFunction } from "express"
import pool from "../db/pool"


// ─────────────────────────────────────────────────────────────
// EXPRESS LOCALS TYPES
// ─────────────────────────────────────────────────────────────
//
// Express gives us:
//
//     res.locals
//
// which is an object that can be used to pass information from
// middleware to the route.
//
// We are adding two properties:
//
//     idempotencyKey
//     finalizeIdempotency
//
// So the route can later do:
//
//     const finalize = res.locals.finalizeIdempotency
//
// and:
//
//     await finalize("complete", responseBody)
//
// or:
//
//     await finalize("failed", responseBody)
//
declare module "express-serve-static-core" {
  interface Locals {

    // The orderID being used as our idempotency key.
    idempotencyKey: string

    // Function supplied by this middleware.
    //
    // The route calls this when it knows the final result.
    //
    // "complete" means the operation succeeded.
    // "failed" means the operation failed.
    //
    // body is the response that we want to save so that a
    // duplicate request can receive the exact same response.
    finalizeIdempotency: (
      status: "complete" | "failed",
      body: object
    ) => Promise<void>
  }
}


// ─────────────────────────────────────────────────────────────
// IDEMPOTENCY MIDDLEWARE
// ─────────────────────────────────────────────────────────────
//
// This middleware runs BEFORE the PayPal capture route.
//
// Example:
//
// app.post(
//   "/api/paypal/capture-order",
//   idempotencyGuard,
//   async (req, res) => {
//      ...
//   }
// )
//
// Therefore:
//
//       CLIENT
//          │
//          ▼
//   idempotencyGuard
//          │
//          ├── first request ──────► next()
//          │                            │
//          │                            ▼
//          │                     PayPal capture route
//          │
//          └── duplicate request
//                    │
//                    ├── complete ──► replay saved response
//                    ├── failed   ──► replay saved response
//                    └── pending  ──► 409
//
export async function idempotencyGuard(
  req: Request,
  res: Response,
  next: NextFunction
) {

  // ───────────────────────────────────────────────────────────
  // 1. GET THE IDEMPOTENCY KEY
  // ───────────────────────────────────────────────────────────
  //
  // For this route, we are using PayPal's orderID as the
  // idempotency key.
  //
  // Example:
  //
  //     req.body.orderID
  //
  // might contain:
  //
  //     "5O190127TN364715T"
  //
  // The "as string | undefined" tells TypeScript that the
  // value is expected to be a string, but might not exist.
  //
  const key = req.body?.orderID as string | undefined


  // If there is no orderID, we cannot perform idempotency
  // protection because we have no key.
  //
  // Return immediately.
  //
  // IMPORTANT:
  // This is a client/request error, not a server error.
  //
  if (!key) {
    return res.status(400).json({
      error: "orderID required"
    })
  }


  // ───────────────────────────────────────────────────────────
  // 2. TRY TO CREATE THE IDEMPOTENCY RECORD
  // ───────────────────────────────────────────────────────────
  //
  // The first request for this orderID should execute:
  //
  //     INSERT INTO idempotency_keys
  //
  // producing something like:
  //
  //     ┌──────────────────────────────┐
  //     │ key              │ status    │
  //     ├──────────────────┼───────────┤
  //     │ 5O190127TN...    │ pending   │
  //     └──────────────────┴───────────┘
  //
  // The important part is that "key" must have a UNIQUE
  // constraint in PostgreSQL.
  //
  // For example:
  //
  //     CREATE TABLE idempotency_keys (
  //       key text PRIMARY KEY,
  //       status text NOT NULL,
  //       response_body jsonb
  //     );
  //
  // Because the key is unique, two simultaneous requests
  // cannot both successfully create the same key.
  //
  try {

    await pool.query(
      `
        INSERT INTO idempotency_keys
          (key, status)
        VALUES
          ($1, 'pending')
      `,
      [key]
    )


    // ─────────────────────────────────────────────────────────
    // 3. WE WON THE INSERT
    // ─────────────────────────────────────────────────────────
    //
    // If we got here, the INSERT succeeded.
    //
    // That means:
    //
    //     THIS IS THE FIRST REQUEST
    //
    // that has claimed this orderID.
    //
    // We now allow the request to continue to the actual
    // PayPal capture route.
    //
    res.locals.idempotencyKey = key


    // ─────────────────────────────────────────────────────────
    // 4. CREATE THE FINALIZATION FUNCTION
    // ─────────────────────────────────────────────────────────
    //
    // The route needs a way to tell this middleware:
    //
    //     "The operation finished successfully."
    //
    // or:
    //
    //     "The operation failed."
    //
    // We create that function here and store it in
    // res.locals.
    //
    // The route can then access it with:
    //
    //     const finalize = res.locals.finalizeIdempotency
    //
    res.locals.finalizeIdempotency = async (
      status: "complete" | "failed",
      body: object
    ) => {

      // ───────────────────────────────────────────────────────
      // SAVE THE FINAL RESULT
      // ───────────────────────────────────────────────────────
      //
      // Example successful result:
      //
      //     status = "complete"
      //
      //     body = {
      //       success: true,
      //       captureID: "123456"
      //     }
      //
      // We save BOTH:
      //
      //     status
      //
      // and:
      //
      //     response_body
      //
      // This is important because a duplicate request needs
      // to receive the same response without performing the
      // PayPal operation again.
      //
      await pool.query(
        `
          UPDATE idempotency_keys
          SET
            status = $1,
            response_body = $2
          WHERE key = $3
        `,
        [
          status,

          // PostgreSQL can store this as JSON/JSONB.
          //
          // JSON.stringify converts the JavaScript object
          // into JSON.
          JSON.stringify(body),

          // Make sure we update ONLY this request's key.
          key
        ]
      )
    }


    // ─────────────────────────────────────────────────────────
    // 5. CONTINUE TO THE PAYPAL ROUTE
    // ─────────────────────────────────────────────────────────
    //
    // next() tells Express:
    //
    //     "The idempotency check passed.
    //      Continue to the next middleware/route."
    //
    // Therefore the actual PayPal capture code now runs.
    //
    return next()


  } catch (err: any) {

    // ─────────────────────────────────────────────────────────
    // 6. DID THE INSERT FAIL BECAUSE THE KEY ALREADY EXISTS?
    // ─────────────────────────────────────────────────────────
    //
    // PostgreSQL error code:
    //
    //     23505
    //
    // means:
    //
    //     unique_violation
    //
    // In our case, this means another request already inserted
    // this orderID.
    //
    // So this is NOT necessarily a server failure.
    //
    // It means:
    //
    //     "We've already seen this orderID."
    //
    if (err.code === "23505") {


      // ───────────────────────────────────────────────────────
      // 7. GET THE EXISTING IDEMPOTENCY RECORD
      // ───────────────────────────────────────────────────────
      //
      // We now ask PostgreSQL what happened with the existing
      // request.
      //
      // We retrieve:
      //
      //     status
      //     response_body
      //
      const { rows } = await pool.query(
        `
          SELECT
            status,
            response_body
          FROM idempotency_keys
          WHERE key = $1
        `,
        [key]
      )


      // Get the first matching row.
      //
      // There should normally be exactly one because "key"
      // is UNIQUE.
      //
      const row = rows[0]


      // ───────────────────────────────────────────────────────
      // 8. SAFETY CHECK
      // ───────────────────────────────────────────────────────
      //
      // In normal circumstances, the row should exist because
      // the INSERT produced the unique-violation.
      //
      // But we still protect against the unexpected case where
      // the row is no longer there.
      //
      if (!row) {
        return next()
      }


      // ───────────────────────────────────────────────────────
      // 9. REQUEST ALREADY FINISHED
      // ───────────────────────────────────────────────────────
      //
      // If the original request already finished, we have its
      // response stored in the database.
      //
      // We DO NOT call PayPal again.
      //
      // We simply replay the saved response.
      //
      // This is the key part of idempotency.
      //
      if (
        row.status === "complete" ||
        row.status === "failed"
      ) {

        return res.status(200).json(row.response_body)
      }


      // ───────────────────────────────────────────────────────
      // 10. ORIGINAL REQUEST IS STILL PROCESSING
      // ───────────────────────────────────────────────────────
      //
      // If the status is still:
      //
      //     pending
      //
      // another request has already claimed this orderID and
      // is currently processing it.
      //
      // We do NOT start another PayPal capture.
      //
      // Instead, return HTTP 409 Conflict.
      //
      // The client can wait and retry later.
      //
      return res.status(409).json({
        error: "order is currently being processed — please wait"
      })
    }


    // ─────────────────────────────────────────────────────────
    // 11. SOME OTHER DATABASE ERROR OCCURRED
    // ─────────────────────────────────────────────────────────
    //
    // If the error was NOT a duplicate-key error, something
    // unexpected happened.
    //
    // For example:
    //
    //     database connection failure
    //     SQL problem
    //     database unavailable
    //
    // Log the actual error on the server.
    //
    console.error("[idempotency]", err)


    // Do not expose internal database details to the client.
    //
    // Return a generic 500 error.
    //
    return res.status(500).json({
      error: "internal error"
    })
  }
}