// ============================================================
// IMPORTS
// ============================================================

// Request and Response are TypeScript types from Express.
//
// Request:
//   Represents the incoming HTTP request.
//
// Response:
//   Represents the response that our server will send back
//   to the Electron application.
import { Request, Response } from "express";


// "pool" is your PostgreSQL connection pool.
//
// This is NOT Express.
//
// This is the object that lets this file execute SQL against
// your PostgreSQL database.
//
// For example:
//
//     await pool.query("SELECT ...");
//
// actually sends the SQL to PostgreSQL.
import pool from "../db/pool";


// This function sends the license email to the customer.
//
// It is your application's email functionality.
//
// It is separate from both Express and PostgreSQL.
import { sendLicenseEmail } from "../utils/mailer";



// ============================================================
// ACTIVATION ENDPOINT
// ============================================================

// This function is the function that Express eventually calls.
//
// Remember your index.ts:
//
// app.post(
//     "/activate",
//     activateLimiter,
//     validateActivationInput,
//     activateLicense
// );
//
// Therefore:
//
//     POST /activate
//            ↓
//     activateLimiter
//            ↓
//     validateActivationInput
//            ↓
//     activateLicense()
//
// req = incoming HTTP request
//
// res = object used to send the HTTP response back to the
// Electron application.
export async function activateLicense(
    req: Request,
    res: Response
) {

    // ========================================================
    // GET DATA FROM THE REQUEST
    // ========================================================

    // Express's express.json() middleware in index.ts has
    // already converted the incoming JSON into req.body.
    //
    // For example, Electron might send:
    //
    // {
    //     username: "Josh",
    //     email_address: "josh@example.com",
    //     time_stamp: "2026-08-09",
    //     product_type: "box",
    //     proofofpurchase: "1111"
    // }
    //
    // Destructuring pulls those five properties out of
    // req.body.
    const {
        username,
        email_address,
        time_stamp,
        product_type,
        proofofpurchase
    } = req.body;


    // Print the received values to the server console.
    //
    // This is useful while developing/debugging so you can
    // see what the Electron application actually sent.
    console.log(
        "!!!!: ",
        username,
        email_address,
        time_stamp,
        product_type,
        proofofpurchase
    );


    // ========================================================
    // NORMALIZE THE INPUT
    // ========================================================

    // Convert the purchase code to a string.
    //
    // If proofofpurchase is null or undefined, use "" instead.
    //
    // trim() removes spaces from the beginning/end.
    //
    // Example:
    //
    //     " 1111 " → "1111"
    const code =
        String(proofofpurchase ?? "").trim();


    // Convert email to a string.
    //
    // ?? "" means:
    //
    //     null / undefined → ""
    //
    // toLowerCase() makes the email lowercase.
    //
    // trim() removes surrounding spaces.
    //
    // Example:
    //
    //     " Josh@Example.COM " → "josh@example.com"
    const email =
        String(email_address ?? "")
            .toLowerCase()
            .trim();


    // Convert username to a string and remove surrounding spaces.
    //
    // Example:
    //
    //     " Josh " → "Josh"
    const name =
        String(username ?? "").trim();



    // ========================================================
    // CHECK PRODUCT TYPE + ACTIVATION CODE
    // ========================================================

    // This determines whether the supplied product type and
    // activation code form a valid pair.
    //
    // BOX requires code 1111.
    //
    // ONLINE requires code 2222.
    //
    // So:
    //
    //     box + 1111   → valid
    //     box + 2222   → invalid
    //
    //     online + 2222 → valid
    //     online + 1111 → invalid
    //
    // The || means "OR".
    const validPair =
        (product_type === "box" &&
            code === "1111") ||

        (product_type === "online" &&
            code === "2222");



    // ========================================================
    // REJECT INVALID ACTIVATION
    // ========================================================

    // If neither valid combination was supplied,
    // stop the function immediately.
    //
    // return means:
    //
    //     DO NOT execute the rest of activateLicense().
    //
    // The Electron application receives:
    //
    // {
    //     success: false,
    //     error: "Invalid activation code"
    // }
    if (!validPair) {

        return res.json({
            success: false,
            error: "Invalid activation code"
        });
    }



    // ========================================================
    // TRY THE ACTUAL ACTIVATION WORK
    // ========================================================

    // Everything inside this try block is code that could
    // potentially fail.
    //
    // For example:
    //
    //     PostgreSQL might be unavailable.
    //     An INSERT might fail.
    //     Email might fail.
    //
    // If an unexpected error escapes the inner code,
    // the catch at the bottom handles it.
    try {



        // ====================================================
        // BOX ACTIVATION
        // ====================================================

        // If this is a physical/box activation, execute this
        // branch.
        if (product_type === "box") {


            // ------------------------------------------------
            // REQUIRE USERNAME AND EMAIL
            // ------------------------------------------------

            // A box activation requires both values.
            //
            // !email means email is empty.
            //
            // !name means username is empty.
            //
            // || means either one being missing causes
            // rejection.
            if (!email || !name) {

                return res.json({
                    success: false,
                    error:
                        "Username and email are required to activate"
                });
            }



            // ------------------------------------------------
            // INSERT ACTIVATION INTO POSTGRESQL
            // ------------------------------------------------

            // THIS IS WHERE THE BOX ACTIVATION IS SAVED.
            //
            // pool.query() sends this SQL to PostgreSQL.
            //
            // INSERT means:
            //
            //     Create a new database row.
            //
            // The table is:
            //
            //     serials
            //
            // The columns being populated are:
            //
            //     username
            //     email_address
            //     time_stamp
            //     product_type
            //     email_sent
            //     activated
            //
            // $1, $2, $3, $4 are PostgreSQL parameters.
            //
            // They correspond to:
            //
            // $1 → name
            // $2 → email
            // $3 → time_stamp
            // $4 → product_type
            //
            // This is a parameterized query, which is important
            // for preventing SQL injection.
            //
            // RETURNING id tells PostgreSQL:
            //
            //     "After inserting the row, give me its id."
            const insertResult = await pool.query(
                `
                INSERT INTO serials
                (
                    username,
                    email_address,
                    time_stamp,
                    product_type,
                    email_sent,
                    activated
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    false,
                    true
                )
                RETURNING id
                `,
                [
                    name,
                    email,
                    time_stamp,
                    product_type
                ]
            );



            // ------------------------------------------------
            // GET THE NEW DATABASE ID
            // ------------------------------------------------

            // PostgreSQL returned the newly inserted row.
            //
            // insertResult.rows is an array of returned rows.
            //
            // Because we inserted one row:
            //
            //     rows[0]
            //
            // is the new row.
            //
            // .id gets its database ID.
            const id =
                insertResult.rows[0].id;



            // Print confirmation to the server console.
            console.log(
                `[activate] new box serial saved — ` +
                `id=${id} email=${email}`
            );



            // =================================================
            // SEND LICENSE EMAIL
            // =================================================

            // Email sending is a SECOND operation after the
            // database INSERT.
            //
            // Notice that this has its own try/catch.
            //
            // Why?
            //
            // Because we don't want an email failure to undo
            // the successful database activation.
            try {

                // Send the license email.
                //
                // The email receives:
                //
                //     customer's email
                //     license/serial ID
                await sendLicenseEmail(
                    email,
                    String(id)
                );


                // If the email succeeded, update PostgreSQL.
                //
                // We change email_sent from false → true.
                await pool.query(
                    `
                    UPDATE serials
                    SET email_sent = true
                    WHERE id = $1
                    `,
                    [id]
                );


            } catch (err) {

                // If sending the email failed, log the error.
                //
                // IMPORTANT:
                //
                // The activation itself is still saved.
                //
                // email_sent remains false.
                //
                // That allows your retry worker to potentially
                // send the email later.
                console.error(
                    `[activate] email failed, will retry — ` +
                    `id=${id}`,
                    err
                );
            }



            // ------------------------------------------------
            // TELL ELECTRON ACTIVATION SUCCEEDED
            // ------------------------------------------------

            // Send JSON back to the Electron application.
            //
            // The Electron fetch() receives:
            //
            // {
            //     success: true
            // }
            return res.json({
                success: true
            });
        }



        // ====================================================
        // ONLINE ACTIVATION
        // ====================================================

        // If we're here, product_type is NOT "box".
        //
        // Because validPair was already checked above,
        // this means the product must be:
        //
        //     "online"
        //
        // The comments explain that the database row was
        // already created during the PayPal capture process.
        //
        // Therefore we are NOT inserting a new row here.
        //
        // Instead, we're finding an existing unpaid/unactivated
        // online license and claiming it.



        // ----------------------------------------------------
        // CLAIM AN EXISTING ONLINE LICENSE
        // ----------------------------------------------------

        // This SQL performs an UPDATE.
        //
        // We are changing:
        //
        //     activated = true
        //
        // for ONE particular row.
        //
        // The row is selected by the subquery below.
        const claim = await pool.query(
            `
            UPDATE serials

            SET activated = true

            WHERE id = (

                SELECT id

                FROM serials

                WHERE product_type = 'online'

                  AND email_sent = true

                  AND activated = false

                ORDER BY id ASC

                LIMIT 1

                FOR UPDATE SKIP LOCKED
            )

            RETURNING
                id,
                username,
                email_address
            `,
            []
        );



        // ====================================================
        // EXPLAINING THE ONLINE QUERY
        // ====================================================

        // The inner SELECT looks for:
        //
        //     product_type = 'online'
        //
        // AND:
        //
        //     email_sent = true
        //
        // AND:
        //
        //     activated = false
        //
        // So it is looking for an online license that:
        //
        //     1. is an online product
        //     2. has already had its email sent
        //     3. hasn't been activated yet
        //
        // ORDER BY id ASC
        //
        // means:
        //
        //     choose the oldest ID first.
        //
        // LIMIT 1
        //
        // means:
        //
        //     only select one license.
        //
        // FOR UPDATE SKIP LOCKED
        //
        // is useful when multiple requests could be trying
        // to claim licenses simultaneously.
        //
        // It helps prevent two concurrent requests from
        // claiming the same row.



        // ----------------------------------------------------
        // DID WE FIND A LICENSE?
        // ----------------------------------------------------

        // If PostgreSQL returned zero rows, there was no
        // available online license to activate.
        if (claim.rows.length === 0) {

            return res.json({
                success: false,
                error:
                    "No available online license to activate"
            });
        }



        // ----------------------------------------------------
        // GET THE CLAIMED LICENSE
        // ----------------------------------------------------

        // PostgreSQL returned the row that was successfully
        // updated.
        //
        // Save that row in a variable.
        const claimed =
            claim.rows[0];


        // Log the successful online activation.
        console.log(
            `[activate] online license claimed — ` +
            `id=${claimed.id} ` +
            `email=${claimed.email_address}`
        );



        // ----------------------------------------------------
        // RETURN ONLINE ACTIVATION RESULT
        // ----------------------------------------------------

        // Send the successful result back to Electron.
        //
        // Unlike the box path, we're returning the username
        // and email that were ALREADY stored in PostgreSQL.
        return res.json({
            success: true,
            username: claimed.username,
            email: claimed.email_address
        });



    // ========================================================
    // UNEXPECTED ERROR
    // ========================================================

    } catch (err) {

        // If something unexpected happened anywhere in the
        // outer try block, log it on the server.
        console.error(
            "[activate]",
            err
        );


        // Tell the Electron application that the server
        // encountered an internal failure.
        //
        // HTTP 500 means:
        //
        //     Internal Server Error
        //
        // The JSON body gives the application a simple
        // explanation as well.
        return res.status(500).json({
            success: false,
            error: "activation failed"
        });
    }
}