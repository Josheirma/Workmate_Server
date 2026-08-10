// Loads environment variables/configuration before the rest
// of the server starts.
//
// For example, this may load:
//   DATABASE_URL
//   PORT
//   ALLOWED_ORIGIN
//   PAYPAL credentials
//   etc.
//
// This is executed immediately when index.ts starts.
import "../server/env";


// Express = the web/API framework.
// Node.js is the runtime executing this entire file.
//
// Express gives us:
//   - HTTP server functionality
//   - routes
//   - middleware
//   - req / res objects
import express from "express";


// Helmet adds HTTP security headers to responses.
//
// For example, it can add headers that help protect against
// certain browser-based attacks.
import helmet from "helmet";


// Morgan logs incoming HTTP requests.
//
// For example:
//   POST /activate 200
//
// This is useful for seeing what requests are hitting the server.
import morgan from "morgan";


// CORS = Cross-Origin Resource Sharing.
//
// This controls which browser origins are allowed to make
// cross-origin requests to this server.
import cors from "cors";


// IMPORTANT:
//
// This imports the FUNCTION called activateLicense.
//
// It does NOT mean activateLicense() runs right now.
//
// You're simply getting a reference to the function so that
// Express can call it later when /activate is requested.
import { activateLicense } from "./routes/activate";


// These are middleware functions that limit how frequently
// certain endpoints can be called.
//
// activateLimiter → protects /activate
// paypalLimiter   → protects PayPal-related routes
import {
    activateLimiter,
    paypalLimiter
} from "./middleware/rateLimit";


// Middleware that checks whether the incoming activation
// request contains valid data.
import { validateActivationInput }
    from "./middleware/validate";


// This imports a collection of PayPal-related Express routes.
import paypalRoutes from "./routes/paypal";


// This imports a background worker that could periodically
// retry failed email operations.
import { startEmailRetryWorker }
    from "./workers/emailRetry";



// ============================================================
// CREATE THE EXPRESS APPLICATION
// ============================================================

// express() creates an Express application object.
//
// "app" will be used to:
//   - register middleware
//   - register routes
//   - start listening for HTTP requests
//
// Think of "app" as the central Express application.
const app = express();



// ============================================================
// SECURITY HEADERS
// ============================================================

// helmet() creates Express middleware.
//
// app.use(...) means:
//
// "Run this middleware for incoming requests."
//
// Helmet modifies the HTTP response headers to add security
// protections.






// app.use(
//     helmet({

//         contentSecurityPolicy: {

//             directives: {

//                 // By default, resources can only come
//                 // from this server's own origin.
//                 defaultSrc: ["'self'"],

//                 // JavaScript is allowed from:
//                 //   1. this server
//                 //   2. PayPal
//                 //   3. PayPal sandbox
//                 scriptSrc: [
//                     "'self'",
//                     "https://www.paypal.com",
//                     "https://www.sandbox.paypal.com"
//                 ],

//                 // Controls where frames/iframes can be loaded from.
//                 frameSrc: [
//                     "https://www.paypal.com",
//                     "https://www.sandbox.paypal.com"
//                 ],

//                 // Controls where the browser can make
//                 // connections from the page.
//                 connectSrc: [
//                     "'self'",
//                     "https://www.paypal.com",
//                     "https://www.sandbox.paypal.com"
//                 ],

//                 // Images may come from:
//                 //   - this server
//                 //   - data URLs
//                 //   - HTTPS resources
//                 imgSrc: [
//                     "'self'",
//                     "data:",
//                     "https:"
//                 ],

//                 // Styles can come from this server and
//                 // inline styles are allowed.
//                 styleSrc: [
//                     "'self'",
//                     "'unsafe-inline'"
//                 ],
//             },
//         },
//     })
// );

//THIS IS USED BECAUSE THE ABOVE HELEMET CONFIGURATION WILL NOT BE THE PRODUCTION FRONTEND SERVER (IT IS ONLY API), PRODUCTION FRONT END SERVER IS MORE LIKELY TO BE SOMETHING LIKE VERCEL IN PRODUCTION.  IN DEVELOPMENT THE FRONTEND SERVER IS VITE, BUT THERE IS NO NEED TO CONFIGURE ALL THIS, JUST WAIT TO DO PRODUCTION. 
app.use(
    helmet({
        crossOriginResourcePolicy: false
    }));



// ============================================================
// CORS
// ============================================================

// CORS determines which browser origins are allowed
// to communicate with this server.
//
// If ALLOWED_ORIGIN exists in your environment variables,
// use it.
//
// Otherwise use:
//     http://localhost:5173
//
// That is commonly the Vite development server.
app.use(
    cors({
        origin:
            process.env.ALLOWED_ORIGIN ||
            "http://localhost:5173"
    })
);



// ============================================================
// JSON BODY PARSER
// ============================================================

// express.json() tells Express:
//
// "When an HTTP request contains JSON, parse it and put
// the resulting JavaScript object into req.body."
//
// For example, Electron could send:
//
// {
//     username: "Josh",
//     email_address: "josh@example.com",
//     product_type: "pro"
// }
//
// Then activate.ts can access:
//
// req.body.username
// req.body.email_address
// req.body.product_type
//
// The 10kb limit prevents extremely large JSON bodies.
app.use(
    express.json({
        limit: "10kb"
    })
);



// ============================================================
// REQUEST LOGGING
// ============================================================

// Morgan logs HTTP requests.
//
// In production:
//     "combined"
//
// In development:
//     "dev"
//
// NODE_ENV determines which logging format is used.
app.use(
    morgan(
        process.env.NODE_ENV === "production"
            ? "combined"
            : "dev"
    )
);



// ============================================================
// PAYPAL ROUTES
// ============================================================

// paypalRoutes contains PayPal-related endpoints.
//
// paypalLimiter runs before those routes.
//
// Conceptually:
//
// request
//    ↓
// paypalLimiter
//    ↓
// paypalRoutes
//
// So PayPal requests are rate-limited before reaching
// their actual route handlers.
app.use(
    paypalLimiter,
    paypalRoutes
);



// ============================================================
// ACTIVATION ROUTE
// ============================================================

// THIS IS THE MOST IMPORTANT LINE FOR YOUR QUESTION.
//
// This creates an HTTP POST endpoint:
//
//     POST /activate
//
// There are THREE functions in the chain:
//
//     activateLimiter
//     validateActivationInput
//     activateLicense
//
// They execute in that order.
//
// The request flow is:
//
// HTTP POST /activate
//          ↓
// activateLimiter
//          ↓
// validateActivationInput
//          ↓
// activateLicense
//          ↓
// PostgreSQL/database work
//          ↓
// response
app.post(
    "/activate",

    // 1. Rate limiting
    //
    // Prevents someone from hammering the activation
    // endpoint with too many requests.
    activateLimiter,

    // 2. Validate the incoming activation data
    //
    // This checks req.body before the main activation
    // function is allowed to run.
    validateActivationInput,

    // 3. THE ACTUAL ACTIVATION FUNCTION
    //
    // This is imported from:
    //
    //     ./routes/activate
    //
    // Express will call this ONLY when a POST request
    // reaches /activate and successfully passes the
    // previous middleware.
    activateLicense
);



// ============================================================
// START THE SERVER
// ============================================================

// Read PORT from the environment.
//
// If PORT isn't defined, use 3000.
const PORT =
    Number(process.env.PORT) || 3000;



// ============================================================
// START LISTENING FOR HTTP REQUESTS
// ============================================================

// app.listen() tells Express/Node:
//
// "Start listening for incoming network connections
// on this port."
//
// If PORT = 3000, the server is available at:
//
//     http://localhost:3000
//
// Your Electron application's:
//
//     fetch("http://localhost:3000/activate")
//
// can therefore reach this server.
const server = app.listen(
    PORT,
    () => {

        // This callback executes once the server
        // successfully starts listening.
        console.log(
            `Workmate server running on port ${PORT} ` +
            `[${process.env.NODE_ENV || "development"}]`
        );

        // This is currently commented out.
        //
        // If uncommented, it would start the email retry
        // background worker after the server starts.
        //
        // startEmailRetryWorker();
    }
);



// ============================================================
// SERVER ERROR HANDLING
// ============================================================

// "server" is the HTTP server returned by app.listen().
//
// We listen for errors on that server.
server.on(
    "error",
    (err: any) => {

        // EADDRINUSE means:
        //
        // "The port is already being used by another program."
        //
        // For example:
        //
        // another program is already using port 3000.
        if (err.code === "EADDRINUSE") {

            // Try the next port.
            //
            // If PORT = 3000:
            //
            //     try 3001
            //
            server.listen(PORT + 1);
        }
    }
);