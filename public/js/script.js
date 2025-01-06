// public/js/script.js
let socket;
let username = '';
let map;
const markers = {};

// Initialize map first
map = L.map("map").setView([0, 0], 16);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "OpenStreetMap"
}).addTo(map);

// Function to get address from coordinates using reverse geocoding
async function getLocationAddress(latitude, longitude) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await response.json();
        return data.display_name;
    } catch (error) {
        console.error('Error getting address:', error);
        return 'Location unavailable';
    }
}

// Initialize socket connection
function initializeSocket() {
    socket = io({
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
    });

    socket.on("active-users", (users) => {
        updateUsersList(users);
    });

    socket.on("receive-location", async (data) => {
        const { id, username, latitude, longitude } = data;
        
        // Get the address for this location
        const address = await getLocationAddress(latitude, longitude);
        
        const popupContent = `
            <div style="min-width: 200px">
                <h3 style="margin: 0 0 8px 0">${username || 'Anonymous'}</h3>
                <p style="margin: 0 0 5px 0"><strong>Latitude:</strong> ${latitude.toFixed(6)}</p>
                <p style="margin: 0 0 5px 0"><strong>Longitude:</strong> ${longitude.toFixed(6)}</p>
                <p style="margin: 0"><strong>Address:</strong> ${address}</p>
            </div>
        `;
        
        if (markers[id]) {
            markers[id].setLatLng([latitude, longitude]);
            markers[id].getPopup().setContent(popupContent);
        } else {
            markers[id] = L.marker([latitude, longitude])
                .bindPopup(popupContent)
                .bindTooltip(username || 'Anonymous', { 
                    permanent: false, 
                    direction: 'top'
                })
                .addTo(map);

            // Add hover events
            markers[id].on('mouseover', function(e) {
                this.openTooltip();
            });
            
            markers[id].on('mouseout', function(e) {
                this.closeTooltip();
            });
        }
        
        // Only center map on own location
        if (id === socket.id) {
            map.setView([latitude, longitude], 16);
        }
    });

    socket.on("user-disconnect", (id) => {
        if (markers[id]) {
            map.removeLayer(markers[id]);
            delete markers[id];
        }
    });
}

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeSocket();
    // Get initial location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                map.setView([latitude, longitude], 16);
                if (socket) {
                    socket.emit("send-location", { latitude, longitude });
                }
            },
            (error) => {
                console.error("Error getting location:", error);
                alert("Please enable location services to use this app.");
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }
});

function joinMap() {
    const usernameInput = document.getElementById('username');
    username = usernameInput.value.trim();
    
    if (username) {
        document.getElementById('nameInput').classList.add('hidden');
        socket.emit('user-join', username);
        initializeGeolocation();
    }
}

function initializeGeolocation() {
    if (navigator.geolocation) {
        // Watch position with high accuracy settings
        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                console.log("Location update:", latitude, longitude); // Debug log
                socket.emit("send-location", { latitude, longitude });
            },
            (error) => {
                console.error("Location tracking error:", error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );

        // Store watchId to clear it later if needed
        window.locationWatchId = watchId;
    }
}

// Update users list in UI
function updateUsersList(users) {
    const usersList = document.getElementById('activeUsers');
    usersList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user.username || 'Anonymous';
        usersList.appendChild(li);
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.locationWatchId) {
        navigator.geolocation.clearWatch(window.locationWatchId);
    }
});