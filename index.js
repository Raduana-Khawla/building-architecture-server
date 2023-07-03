const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 8000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wjlgu.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("constructionDbUser");
    const homeDesignCollection = database.collection("homeDesign");
    const usersCollection = database.collection("users");
    const apartmentBookingCollection = database.collection("apartmentBooking");
    const apartmentRentCollection = database.collection("apartmentRent");
    const serviceItemsCollection = client
      .db("constructionDbUser")
      .collection("items");
    const ordersCollection = client
      .db("constructionDbUser")
      .collection("orders");

    // get all services
    app.get("/homeDesign", async (req, res) => {
      const result = await homeDesignCollection.find({}).toArray();
      res.json(result);
    });
    //get apartmentBooking
    app.get("/apartmentBooking", async (req, res) => {
      const result = await apartmentBookingCollection.find({}).toArray();
      res.json(result);
    });

    // get all ServiceItems
    app.get("/allServiceItems", async (req, res) => {
      const result = await serviceItemsCollection.find({}).toArray();
      res.json(result);
    });
    // single service
    app.get("/singleService/:id", async (req, res) => {
      console.log(req.params.id);
      const result = await apartmentBookingCollection
        .find({ _id: ObjectId(req.params.id) })
        .toArray();
      res.json(result[0]);
    });
    // insert order and

    app.post("/addOrders", async (req, res) => {
      // console.log(req.body);
      const result = await ordersCollection.insertOne(req.body);
      res.json(result);
    });

    //  my order

    app.get("/myOrder/:email", async (req, res) => {
      // console.log(req.params.email);
      const result = await ordersCollection
        .find({ email: req.params.email })
        .toArray();
      res.json(result);
    });

    //get RentapartmentBooking
    app.get("/apartmentRent", async (req, res) => {
      const result = await apartmentRentCollection.find({}).toArray();
      res.json(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      console.log(result);
      res.json(result);
    });

    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res
          .status(403)
          .json({ message: "you do not have access to make admin" });
      }
    });
    app.put("/makeAdmin", async (req, res) => {
      const filter = { email: req.body.email };
      const result = await usersCollection.find(filter).toArray();
      if (result) {
        const documents = await usersCollection.updateOne(filter, {
          $set: { role: "admin" },
        });
        console.log(documents);
      }
    });

    // check admin or not
    app.get("/checkAdmin/:email", async (req, res) => {
      const result = await usersCollection
        .find({ email: req.params.email })
        .toArray();

      res.json(result);
    });
    //order delete
    app.delete("/deleteOrder/:id", async (req, res) => {
      const result = await ordersCollection.deleteOne({
        _id: ObjectId(req.params.id),
      });
      // console.log(result);
      res.json(result);
    });
    /// all order
    app.get("/allOrders", async (req, res) => {
      // console.log("hello");
      const result = await ordersCollection.find({}).toArray();
      res.json(result);
    });

    // status update
    app.put("/statusUpdate/:id", async (req, res) => {
      const filter = { _id: ObjectId(req.params.id) };
      console.log(req.params.id);
      const result = await ordersCollection.updateOne(filter, {
        $set: {
          status: req.body.status,
        },
      });
      res.json(result);
    });
  } finally {
    // await client.close();
  }
}

run().catch((err) => console.error(err));

app.get("/", (req, res) => {
  res.send("noor construction server is running");
});

app.listen(port, () => {
  console.log(`website running on: ${port}`);
});
