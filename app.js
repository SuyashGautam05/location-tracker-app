const express = require("express");
const app = express();
const path = require("path");
const http = require("http");
const socketio = require("socket.io");

const server = http.createServer(app);

const io = socketio(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        transports: ['websocket', 'polling'],
        credentials: true
    },
    allowEIO3: true
});

// Store active users
const activeUsers = new Map();

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.get("/", (req, res) => {
    try {
        res.render("index");
    } catch (error) {
        console.error("Error rendering index:", error);
        res.status(500).send("Error rendering page");
    }
});

io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Handle user join with name
    socket.on("user-join", (username) => {
        activeUsers.set(socket.id, {
            username: username,
            location: null
        });
        // Send current active users to the new user
        const usersArray = Array.from(activeUsers).map(([id, data]) => ({
            id,
            username: data.username,
            location: data.location
        }));
        io.emit("active-users", usersArray);
    });

    socket.on("send-location", (data) => {
        try {
            const user = activeUsers.get(socket.id);
            if (user) {
                user.location = {
                    latitude: data.latitude,
                    longitude: data.longitude
                };
                io.emit("receive-location", {
                    id: socket.id,
                    username: user.username,
                    ...data
                });
            }
        } catch (error) {
            console.error("Error handling location:", error);
        }
    });

    socket.on("disconnect", () => {
        try {
            activeUsers.delete(socket.id);
            io.emit("user-disconnect", socket.id);
            console.log("Client disconnected:", socket.id);
        } catch (error) {
            console.error("Error handling disconnect:", error);
        }
    });
});

app.use((err, req, res, next) => {
    console.error("Server Error:", err);
    res.status(500).send('Server Error - Please try again');
});

app.use((req, res) => {
    res.status(404).send('Page not found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
// start the server npx nodemon app.js