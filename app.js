const express = require("express")
const app = express();
const path = require("path");
const http = require("http");
const socketio = require("socket.io")

const server = http.createServer(app);
const io = socketio(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// Socket.IO events
io.on("connection", function (socket) {
    console.log("New client connected");

    socket.on("send-location", function(data) {
        io.emit("receive-location", {id: socket.id, ...data});
    });
    
    socket.on("disconnect", function () {
        io.emit("user-disconnect", socket.id);
        console.log("Client disconnected");
    });
});

// Routes
app.get("/", function (req, res) {
    res.render("index");
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Port configuration
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
// start the server npx nodemon app.js