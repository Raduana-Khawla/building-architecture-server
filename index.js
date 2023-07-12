const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const SSLCommerzPayment = require("sslcommerz");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 8000;
const { v4: uuidv4 } = require("uuid");
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
    const sslOrderCollection = client
      .db("constructionDbUser")
      .collection("sslOrders");
    // Initialize payment
    app.post("/init", async (req, res) => {
      console.log("hitting");
      const productInfo = {
        total_amount: req.body.total_amount,
        currency: "BDT",
        tran_id: uuidv4(),
        success_url: "http://localhost:5000/success",
        fail_url: "http://localhost:5000/failure",
        cancel_url: "http://localhost:5000/cancel",
        ipn_url: "http://localhost:5000/ipn",
        paymentStatus: "pending",
        shipping_method: "Courier",
        product_name: req.body.product_name,
        product_category: "Electronic",
        product_profile: req.body.product_profile,
        product_image: req.body.product_image,
        cus_name: req.body.cus_name,
        cus_email: req.body.cus_email,
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: req.body.cus_name,
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
        multi_card_name: "mastercard",
        value_a: "ref001_A",
        value_b: "ref002_B",
        value_c: "ref003_C",
        value_d: "ref004_D",
      };
      // Insert order info
      const result = await sslOrderCollection.insertOne(productInfo);

      const sslcommer = new SSLCommerzPayment(
        process.env.STORE_ID,
        process.env.STORE_PASSWORD,
        false
      ); //true for live default false for sandbox
      sslcommer.init(productInfo).then((data) => {
        //process the response that got from sslcommerz
        //https://developer.sslcommerz.com/doc/v4/#returned-parameters
        const info = { ...productInfo, ...data };
        //console.log(info.GatewayPageURL);
        if (info.GatewayPageURL) {
          res.json(info.GatewayPageURL);
        } else {
          return res.status(400).json({
            message: "SSL session was not successful",
          });
        }
      });
    });
    app.post("/success", async (req, res) => {
      const result = await sslOrderCollection.updateOne(
        { tran_id: req.body.tran_id },
        {
          $set: {
            val_id: req.body.val_id,
          },
        }
      );

      res.redirect(`http://localhost:3000/success/${req.body.tran_id}`);
    });
    app.post("/failure", async (req, res) => {
      const result = await sslOrderCollection.deleteOne({
        tran_id: req.body.tran_id,
      });

      res.redirect(`http://localhost:3000`);
    });
    app.post("/cancel", async (req, res) => {
      const result = await sslOrderCollection.deleteOne({
        tran_id: req.body.tran_id,
      });

      res.redirect(`http://localhost:3000`);
    });
    app.post("/ipn", (req, res) => {
      console.log(req.body);
      res.send(req.body);
    });
    app.post("/validate", async (req, res) => {
      const result = await sslOrderCollection.findOne({
        tran_id: req.body.tran_id,
      });

      if (result.val_id === req.body.val_id) {
        const update = await sslOrderCollection.updateOne(
          { tran_id: req.body.tran_id },
          {
            $set: {
              paymentStatus: "paymentComplete",
            },
          }
        );
        console.log(update);
        res.send(update.modifiedCount > 0);
      } else {
        res.send("Chor detected");
      }
    });
    app.get("/orders/:tran_id", async (req, res) => {
      const id = req.params.tran_id;
      const result = await sslOrderCollection.findOne({ tran_id: id });
      res.json(result);
    });
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
        .find({ _id: new ObjectId(req.params.id) })
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
        _id: new ObjectId(req.params.id),
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
      const filter = { _id: new ObjectId(req.params.id) };
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
