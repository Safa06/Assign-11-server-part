const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;
const Stripe = require("stripe");



// Middleware
app.use(cors());
app.use(express.json());


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);



// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster0.2pjciaj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect(); // Connect to MongoDB
    const db = client.db("productsDB");
    const productCollection = db.collection("products");
    const ordersCollection = db.collection("orders");
    const usersCollection = db.collection("users");

    pp.post("/create-payment-intent", async (req, res) => {
      try {
        const { amount } = req.body; // amount in cents
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Payment failed" });
      }
    });


    // Home page: get 6 products
    app.get("/products", async (req, res) => {
      const result = await productCollection
        .find()
        .limit(6) // remove .sort if no createdAt
        .toArray();

      console.log(result); // for debugging
      res.send(result);
    });

    // fetch all products (All Products page)
    app.get("/all-products", async (req, res) => {
      const result = await productCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    // Get single product by id (PUBLIC)
    app.get("/products/:id", async (req, res) => {
      const { id } = req.params;

      const product = await productCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!product) {
        return res.status(404).send({ message: "Product not found" });
      }

      res.send(product);
    });

    // POST new order -- booking form
    app.post("/orders", async (req, res) => {
      const orderData = req.body;
      orderData.createdAt = new Date();
      orderData.status = "Pending"; // default
      const result = await ordersCollection.insertOne(orderData);
      res.send({ success: true, insertedId: result.insertedId });
    });

    // User - fetch orders by email (My Orders page)
    app.get("/my-orders", async (req, res) => {
      try {
        const email = req.query.email;
        const orders = await ordersCollection.find({ email }).toArray();
        res.send(orders);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch user orders" });
      }
    });

    // GET single order by ID (for user track order)
    app.get("/my-orders/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const order = await ordersCollection.findOne({ _id: new ObjectId(id) });

        if (!order) return res.status(404).send({ message: "Order not found" });

        res.send(order);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch order" });
      }
    });

    // DELETE order
    app.delete("/my-orders/:id", async (req, res) => {
      const id = req.params.id;
      const order = await ordersCollection.findOne({ _id: new ObjectId(id) });

      if (!order) return res.status(404).send({ message: "Order not found" });

      const result = await ordersCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({ success: true, deletedCount: result.deletedCount });
    });

    ///admin side----

    app.post("/users", async (req, res) => {
      try {
        const { name, email, role } = req.body;

        // check if user exists
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(400).send({ message: "User already exists" });
        }

        const result = await usersCollection.insertOne({
          name,
          email,
          role: role || "user",
          createdAt: new Date(),
        });
        res.send({ success: true, insertedId: result.insertedId });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to create user" });
      }
    });

    // ----------------------------
    // GET USERS BY EMAIL (Login or fetch role)
    // ----------------------------
    app.get("/users", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) return res.status(400).send({ message: "Email required" });

        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(404).send({ message: "User not found" });

        res.send(user); // include role, name, email
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to fetch user" });
      }
    });

    // ----------------------------
    // UPDATE USER ROLE / STATUS
    // ----------------------------
    app.patch("/users/:id", async (req, res) => {
      try {
        const { role } = req.body;
        const id = req.params.id;

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role } }
        );

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to update user role" });
      }
    });

    // ----------------------------
    // GET ALL USERS (Admin - Manage Users Page)
    // ----------------------------
    app.get("/manage-users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send(users);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch users" });
      }
    });

    //dashboard
    // Get all products
    app.get("/all-products", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    // Delete a product
    app.delete("/all-products/:id", async (req, res) => {
      const id = req.params.id;
      const result = await productCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Update "Show on Home" toggle
    app.patch("/all-products/:id/show-home", async (req, res) => {
      const id = req.params.id;
      const { showHome } = req.body;
      const result = await productCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { showHome } }
      );
      res.send(result);
    });

    // Update product info (title, price, description, category)
    app.patch("/all-products/:id", async (req, res) => {
      const id = req.params.id;
      const { title, description, price, category } = req.body;
      const result = await productCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { title, description, price, category } }
      );
      res.send(result);
    });

    // Toggle showHome  (admin-home-admin)
    app.patch("/products/show-home/:id", async (req, res) => {
      const id = req.params.id;
      const { showHome } = req.body;

      const result = await productCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { showHome } }
      );

      res.send(result);
    });

    app.patch("/products/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedProduct = req.body;

        const result = await productCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              title: updatedProduct.title,
              price: updatedProduct.price,
              description: updatedProduct.description,
              category: updatedProduct.category,
              image: updatedProduct.image,
            },
          }
        );

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to update product" });
      }
    });

    app.delete("/products/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await productCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Product not found" });
        }

        res.send({ message: "Product deleted successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to delete product" });
      }
    });

    // Admin - update order status (approve/reject)
    app.patch("/all-orders/:id", async (req, res) => {
      try {
        const { status } = req.body;
        const id = req.params.id;

        const result = await ordersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to update order" });
      }
    });

    // Admin - fetch all orders
    app.get("/all-orders", async (req, res) => {
      try {
        const result = await ordersCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch all orders" });
      }
    });

    // Get single order by ID -- admin All orders page View button to see all the orders
    app.get("/orders/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const order = await ordersCollection.findOne({ _id: new ObjectId(id) });
        if (!order) return res.status(404).send({ message: "Order not found" });
        res.send(order);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch order" });
      }
    });

    // When creating an order
    app.post("/orders", async (req, res) => {
      const orderData = req.body;

      orderData.createdAt = new Date();
      orderData.status = "Pending";
      orderData.tracking = [{ status: "Pending", date: new Date() }];

      const result = await ordersCollection.insertOne(orderData);
      res.send({ success: true, insertedId: result.insertedId });
    });

    // Update order status + add tracking
    app.patch("/all-orders/:id", async (req, res) => {
      const { status } = req.body;
      const id = req.params.id;

      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: { status },
          $push: {
            tracking: { status, date: new Date() },
          },
        }
      );

      res.send(result);
    });

    // Get order details
    app.get("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const order = await ordersCollection.findOne({ _id: new ObjectId(id) });
      if (!order) return res.status(404).send({ message: "Order not found" });
      res.send(order);
    });

    app.get("/manager-products", async (req, res) => {
      const email = req.query.email;
      const result = await productsCollection
        .find({ managerEmail: email })
        .toArray();
      res.send(result);
    });

    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const result = await productsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.get("/pending-orders", async (req, res) => {
      try {
        const result = await orderCollection
          .find({ status: "Pending" })
          .toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch pending orders" });
      }
    });

    app.patch("/pending-orders/:id", async (req, res) => {
      try {
        const { status } = req.body; // "Approved" or "Rejected"
        const id = req.params.id;

        const updateData = { status };
        if (status === "Approved") {
          updateData.approvedAt = new Date();
        }

        const result = await ordersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        if (result.matchedCount === 0)
          return res.status(404).send({ message: "Order not found" });

        res.send({ success: true });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to update order status" });
      }
    });

    // approved orders
    // GET approved orders for manager
    app.get("/approved-orders", async (req, res) => {
      try {
        const approvedOrders = await ordersCollection
          .find({ status: "Approved" })
          .toArray();
        res.send(approvedOrders);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch approved orders" });
      }
    });

    // PATCH to add tracking info
    app.patch("/approved-orders/:id/tracking", async (req, res) => {
      try {
        const id = req.params.id;
        const { location, note, status } = req.body;

        const trackingEntry = {
          location,
          note,
          status,
          date: new Date(),
        };

        const result = await ordersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $push: { tracking: trackingEntry } } // Push to tracking array
        );

        if (result.matchedCount === 0)
          return res.status(404).send({ message: "Order not found" });

        res.send({ success: true });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to add tracking info" });
      }
    });
  } catch (err) {
    console.error(err);
  }
}











run().catch(console.dir);

// Test route
app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
