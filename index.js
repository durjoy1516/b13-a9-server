const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();

// ==================== 1. CORS CONFIGURATION ====================
const corsOptions = {
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle Preflight Requests globally
app.use(express.json());

// ==================== 2. JWT MIDDLEWARE ====================
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

// ==================== 3. MONGODB SETUP ====================
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cu9mlf8.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let clientPromise;

async function connectDB() {
  if (!clientPromise) {
    clientPromise = client.connect();
  }
  const connectedClient = await clientPromise;
  return connectedClient.db('tutorFinderDB');
}

// ==================== ROUTES ====================

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

app.get('/my-tutors', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      return res.status(400).send({ message: "Email parameter is required" });
    }

    const query = { $or: [{ email: email }, { userEmail: email }] };
    const db = await connectDB();
    const tutorsCollection = db.collection('tutors');
    const result = await tutorsCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error fetching my tutors", error: error.message });
  }
});

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

app.post('/bookings', async (req, res) => {
  try {
    const bookingData = req.body;
    const db = await connectDB();
    
    const tutor = await db.collection('tutors').findOne({ _id: new ObjectId(bookingData.tutorId) });
    
    if (!tutor) {
      return res.status(404).send({ message: "Tutor not found" });
    }

    if (tutor.totalSlot <= 0) {
      return res.status(400).send({ message: "This session is fully booked. You can't join at the moment." });
    }

    const bookingsCollection = db.collection('bookings');
    const result = await bookingsCollection.insertOne(bookingData);

    await db.collection('tutors').updateOne(
      { _id: new ObjectId(bookingData.tutorId) },
      { $inc: { totalSlot: -1 } }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Booking failed", error: error.message });
  }
});

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

// FIXED BUG HERE: changed tutorsCollection to bookingsCollection
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

module.exports = app;