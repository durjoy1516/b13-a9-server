const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

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

// Database & Collection Helper (Cached for Vercel Serverless)
let cachedDb = null;

async function connectDB() {
  if (cachedDb) {
    return cachedDb;
  }
  await client.connect();
  const db = client.db('tutorFinderDB');
  cachedDb = db;
  console.log(">>> Connected to MongoDB Database Successfully! <<<");
  return db;
}

// ==================== ROUTES ====================

// Root Route
app.get('/', (req, res) => {
  res.send('Tutor Finder Server Running Cleanly!');
});

// 1. Get All Tutors
app.get('/tutors', async (req, res) => {
  try {
    const db = await connectDB();
    const tutorsCollection = db.collection('tutors');
    const result = await tutorsCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error fetching tutors", error: error.message });
  }
});

// 2. Get Single Tutor Details
app.get('/tutors/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const db = await connectDB();
    const tutorsCollection = db.collection('tutors');
    const query = { _id: new ObjectId(id) };
    const result = await tutorsCollection.findOne(query);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error fetching tutor", error: error.message });
  }
});

// 3. Add New Tutor
app.post('/tutors', async (req, res) => {
  try {
    const newTutor = req.body;
    const db = await connectDB();
    const tutorsCollection = db.collection('tutors');
    const result = await tutorsCollection.insertOne(newTutor);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error adding tutor", error: error.message });
  }
});

// Vercel / Local Server Export
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
  });
}

module.exports = app;