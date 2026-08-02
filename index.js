const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const tutorsData = require('./tutors.json');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cu9mlf8.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let tutorsCollection;

async function run() {
  try {
    // Database and Collection setup
    const db = client.db('tutorFinderDB');
    tutorsCollection = db.collection('tutors');

    console.log(">>> Connected to MongoDB Database Successfully! <<<");

    // =========================================================
    // 🚀 ২৫টি ডাটা একবারে ইনসার্ট করার কোড
    // (ডাটা ইনসার্ট হওয়ার পর নিচের ৩টি লাইন কমেন্ট // করে দেবেন)
    // =========================================================
    // const result = await tutorsCollection.insertMany(tutorsData);
    // console.log(`🎉 সফলভাবে ${result.insertedCount} টি টিউটর ডাটাবেজে যুক্ত হয়েছে!`);
    // // =========================================================

  } catch (error) {
    console.error("Database connection error:", error);
  }
}
run().catch(console.dir);

// ==================== ROUTES ====================

// Root Route
app.get('/', (req, res) => {
  res.send('Tutor Finder Server Running Cleanly!');
});

// 1. Get All Tutors
app.get('/tutors', async (req, res) => {
  try {
    if (!tutorsCollection) {
      return res.status(500).send({ message: "Database not connected yet" });
    }
    const cursor = tutorsCollection.find();
    const result = await cursor.toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error fetching tutors", error });
  }
});

// 2. Get Single Tutor Details
app.get('/tutors/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await tutorsCollection.findOne(query);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error fetching tutor", error });
  }
});

// 3. Add New Tutor
app.post('/tutors', async (req, res) => {
  try {
    const newTutor = req.body;
    const result = await tutorsCollection.insertOne(newTutor);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error adding tutor", error });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});