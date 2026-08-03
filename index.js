const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware (CORS Configuration for Vercel Deployment)
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// JWT Verification Middleware
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'Unauthorized access' });
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'secret_key', (err, decoded) => {
    if (err) {
      return res.status(403).send({ error: true, message: 'Forbidden access' });
    }
    req.decoded = decoded;
    next();
  });
};

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

// ---------------- 1. JWT API ----------------
app.post('/jwt', (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET || 'secret_key', { expiresIn: '7d' });
  res.send({ token });
});

// ---------------- 2. TUTORS API ----------------

// Get All Tutors (Supports Search & Date Filter)
app.get('/tutors', async (req, res) => {
  try {
    const { search, startDate, endDate, limit } = req.query;
    let query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (startDate && endDate) {
      query.sessionStartDate = {
        $gte: startDate,
        $lte: endDate
      };
    }

    const db = await connectDB();
    const tutorsCollection = db.collection('tutors');
    
    let cursor = tutorsCollection.find(query);
    if (limit) {
      cursor = cursor.limit(parseInt(limit));
    }

    const result = await cursor.toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error fetching tutors", error: error.message });
  }
});

// Get My Added Tutors (MY TUTORS PAGE FIX)
app.get('/my-tutors', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      return res.status(400).send({ message: "Email parameter is required" });
    }

    // email অথবা userEmail যেকোনো ফিল্ডের সাথে মিললেই টিউটর দেখাবে
    const query = { $or: [{ email: email }, { userEmail: email }] };
    const db = await connectDB();
    const tutorsCollection = db.collection('tutors');
    const result = await tutorsCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error fetching my tutors", error: error.message });
  }
});

// Get Single Tutor Details
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

// Add New Tutor
app.post('/tutors', async (req, res) => {
  try {
    const newTutor = req.body;
    if (newTutor.totalSlot) {
      newTutor.totalSlot = Number(newTutor.totalSlot);
    }
    const db = await connectDB();
    const tutorsCollection = db.collection('tutors');
    const result = await tutorsCollection.insertOne(newTutor);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error adding tutor", error: error.message });
  }
});

// Update Tutor Info
app.put('/tutors/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updatedData = req.body;
    if (updatedData.totalSlot) {
      updatedData.totalSlot = Number(updatedData.totalSlot);
    }

    const db = await connectDB();
    const tutorsCollection = db.collection('tutors');
    const filter = { _id: new ObjectId(id) };
    const updatedDoc = {
      $set: {
        name: updatedData.name,
        subject: updatedData.subject,
        hourlyRate: Number(updatedData.hourlyRate),
        institution: updatedData.institution,
        image: updatedData.image,
        bio: updatedData.bio,
        totalSlot: Number(updatedData.totalSlot),
        teachingMode: updatedData.teachingMode,
        sessionStartDate: updatedData.sessionStartDate
      }
    };
    const result = await tutorsCollection.updateOne(filter, updatedDoc);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error updating tutor", error: error.message });
  }
});


// Delete Tutor
app.delete('/tutors/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const db = await connectDB();
    const tutorsCollection = db.collection('tutors');
    const query = { _id: new ObjectId(id) };
    const result = await tutorsCollection.deleteOne(query);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error deleting tutor", error: error.message });
  }
});

// ---------------- 3. BOOKINGS API ----------------

// Add Booking & Auto-Decrease Tutor Slot
app.post('/bookings', async (req, res) => {
  try {
    const bookingData = req.body;
    const db = await connectDB();
    
    // Check Tutor's total slots
    const tutor = await db.collection('tutors').findOne({ _id: new ObjectId(bookingData.tutorId) });
    
    if (!tutor) {
      return res.status(404).send({ message: "Tutor not found" });
    }

    if (tutor.totalSlot <= 0) {
      return res.status(400).send({ message: "This session is fully booked. You can't join at the moment." });
    }

    // Insert Booking Record
    const bookingsCollection = db.collection('bookings');
    const result = await bookingsCollection.insertOne(bookingData);

    // Auto Decrease Tutor totalSlot by 1
    await db.collection('tutors').updateOne(
      { _id: new ObjectId(bookingData.tutorId) },
      { $inc: { totalSlot: -1 } }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Booking failed", error: error.message });
  }
});

// Get Bookings by User Email (MY BOOKINGS PAGE FIX)
app.get('/bookings', async (req, res) => {
  try {
    const email = req.query.email;
    let query = {};
    if (email) {
      query = { 
        $or: [
          { userEmail: email }, 
          { studentEmail: email },
          { email: email }
        ] 
      };
    }
    const db = await connectDB();
    const bookingsCollection = db.collection('bookings');
    const result = await bookingsCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error fetching bookings", error: error.message });
  }
});

// Update Booking Status (Cancel করার জন্য)
app.patch('/bookings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    const db = await connectDB();
    const bookingsCollection = db.collection('bookings');
    const filter = { _id: new ObjectId(id) };
    const updatedDoc = {
      $set: { status: status || 'cancelled' }
    };
    const result = await bookingsCollection.updateOne(filter, updatedDoc);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error updating booking status", error: error.message });
  }
});

// Delete Booking
app.delete('/bookings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const db = await connectDB();
    const bookingsCollection = db.collection('bookings');
    const query = { _id: new ObjectId(id) };
    const result = await bookingsCollection.deleteOne(query);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error deleting booking", error: error.message });
  }
});

// Vercel / Local Server Export
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
  });
}

module.exports = app;