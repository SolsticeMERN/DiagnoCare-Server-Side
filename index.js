require("dotenv").config();
const express = require("express");
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "https://api.imgbb.com/1/upload", "https://bistro-res.web.app"],
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
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    const bannerCollection = client.db("DiagnoCare").collection("banner");
    const testsCollection = client.db("DiagnoCare").collection("tests");
    const recommendCollection = client.db("DiagnoCare").collection("recommend");
    const usersCollection = client.db("DiagnoCare").collection("users");




    // jwt api
    app.post('/jwt', async(req, res)=> {
      const user = req.body
      const token = jwt.sign(user, process.env.SECRECT_KEY, {
        expiresIn: "1h"
      });
      res.send({token})
    })

    // middleware

    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message: "unathorization access"});
      }
      const token = req.headers.authorization.split(' ')[1]
      jwt.verify(token, process.env.SECRECT_KEY, (err, decoded) => {
        if(err){
          return res.status(401).send({message: "unathorization access"});
        }
        req.decoded = decoded
        next()
      })
     
    }


    // save users api
    app.post('/users', async(req, res) => {
      const user = req.body
      const query = {email: user?.email}
      const userExists = await usersCollection.findOne(query);
      if (userExists) {
        return res.send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })


    // banner api from db
    app.get('/banner', async(req, res) => {
      const result = await bannerCollection.find({}).toArray()
      res.send(result)
    })

    // tests api from db
    app.get('/tests',  async(req, res) => {
      const result = await testsCollection.find({}).toArray()
      res.send(result)
    })

    // features api from db
    app.get('/featured-tests', verifyToken,  async(req, res) => {
      const tests= await testsCollection.find({}).toArray()
      tests.sort((a, b) => b.bookings - a.bookings)
      const featuredTests=tests.slice(0,3)
      res.send(featuredTests)
    })

    // recommend api from db
    app.get('/recommend', async(req, res) => {
      const result = await recommendCollection.find({}).toArray()
      res.send(result)
    })


    // viewDetails api from db
    app.get('/testDetails/:id', async(req, res) => {
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await testsCollection.findOne(query)
      res.send(result)
    })


















    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("DiagnoCare Server is running");
  });
  
  app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
  });
