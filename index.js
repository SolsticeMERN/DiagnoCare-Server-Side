// server.js

require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 3000;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://api.imgbb.com/1/upload",
      "https://bistro-res.web.app",
    ],
    credentials: true,
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0rmazcr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();
    console.log("Connected to MongoDB");

    const bannerCollection = client.db("DiagnoCare").collection("banner");
    const testsCollection = client.db("DiagnoCare").collection("tests");
    const recommendCollection = client.db("DiagnoCare").collection("recommend");
    const usersCollection = client.db("DiagnoCare").collection("users");
    const bookingsCollection = client.db("DiagnoCare").collection("bookings");

    // JWT API
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.SECRECT_KEY, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // Middleware to verify JWT token
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      console.log(token);
      jwt.verify(token, process.env.SECRECT_KEY, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;
        console.log(req.decoded.email);
        next();
      });
    };

    // middleware admin verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      console.log(query);
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      console.log(isAdmin);
      if (!isAdmin) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      next();
    };

    // Stripe payment API
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = Math.round(price * 100);

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (err) {
        console.error("Error creating payment intent:", err);
        res.status(500).send({ error: "Failed to create payment intent" });
      }
    });

    // Save user API
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const userExists = await usersCollection.findOne(query);
      if (userExists) {
        return res.send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // user get api
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      res.send(user);
    });

    // get Banner API from DB
    app.get("/banner", async (req, res) => {
      const result = await bannerCollection.find({}).toArray();
      res.send(result);
    });

    // post Banner API from DB
    app.post("/banner", async (req, res) => {
      const bannerInfo = req.body
      console.log(bannerInfo);
      const result = await bannerCollection.insertOne(bannerInfo)
      res.send(result);
    });

    // user status update api
    app.patch(
      "/bannerUpdate/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const status = req.body;
        console.log(status);
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: status,
        };
        const result = await bannerCollection.updateOne(filter, updateDoc);
        console.log(result);
        res.send(result);
      }
    );

    // get Tests API from DB
    app.get("/tests", async (req, res) => {
      const result = await testsCollection.find({}).toArray();
      res.send(result);
    });

    // Post Tests API from DB
    app.post("/tests", async (req, res) => {
      const bookingData = req.body;
      const result = await testsCollection.insertOne(bookingData);
      res.send(result);
    });

    // test delete from db
    app.delete("/test/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      try {
        const result = await testsCollection.deleteOne(query);
        res.send(result);
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // test to update in db
    app.patch("/update-test/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updateInfo = req.body;

      try {
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            ...updateInfo,
          },
        };

        const result = await testsCollection.updateOne(query, updateDoc);
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Update not found" });
        }

        res.status(200).send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // Featured tests API from DB
    app.get("/featured-tests", async (req, res) => {
      const tests = await testsCollection.find({}).toArray();
      tests.sort((a, b) => b.bookings - a.bookings);
      const featuredTests = tests.slice(0, 3);
      res.send(featuredTests);
    });

    // Recommend API from DB
    app.get("/recommend", verifyToken, async (req, res) => {
      const result = await recommendCollection.find({}).toArray();
      res.send(result);
    });

    // View details API from DB
    app.get("/testDetails/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await testsCollection.findOne(query);
      res.send(result);
    });

    // Booking API to save booking data
    app.post("/booking", verifyToken, async (req, res) => {
      const bookingData = req.body;
      const result = await bookingsCollection.insertOne(bookingData);
      res.send(result);
    });

    // Endpoint to update slots
    app.patch("/update-slots/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { slots } = req.body;

      try {
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            slots: slots,
          },
          $inc: { bookings: 1 },
        };

        const result = await testsCollection.updateOne(query, updateDoc);
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Booking not found" });
        }

        res.status(200).send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

     // get reservation api
     app.get("/reservation", verifyToken, verifyAdmin, async (req, res) => {
      const result = await bookingsCollection.find({}).toArray();
      res.send(result);
    });



    // get booking api
    app.get("/booking/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    // get bookings by bookingId
    app.get("/bookings/test/:bookingId", verifyToken, verifyAdmin, async (req, res) => {
      const bookingId = req.params.bookingId;
      const query = { bookingId: bookingId };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    // booking room cancel
    app.delete("/booking-test/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      try {
        const result = await bookingsCollection.deleteOne(query);
        res.send(result);
      } catch (err) {
        res.status(500).send(err);
      }
    });


    //  admin menu api

    // get all the users from db
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send(users);
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // User role update API
    app.patch("/roleUpdate/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const role = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: role,
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // user status update api
    app.patch(
      "/statusUpdate/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const status = req.body;
        console.log(status);
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: status,
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        console.log(result);
        res.send(result);
      }
    );

      // delete reservation room cancel
      app.delete("/booking-reservation/:id", verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        try {
          const result = await bookingsCollection.deleteOne(query);
          res.send(result);
        } catch (err) {
          res.status(500).send(err);
        }
      });

    app.get("/", (req, res) => {
      res.send("DiagnoCare Server is running");
    });

    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
}

run().catch(console.error);
