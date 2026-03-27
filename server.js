const express = require('express');
const dotenv = require('dotenv').config();
const cookieParser = require('cookie-parser');
const db = require('./Models/index.js'); // Update the import path for models
const userRoutes = require('./Routes/userRoutes.js');
const hostRoutes = require('./Routes/hostRoutes');
const adminRoutes = require('./Routes/adminRoutes');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const helmet = require('helmet');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
const cabRoutes = require('./Routes/cabRoutes');
// const { initCronJobs } = require('./Utils/cronJobs');

// Setting up your port
const PORT = process.env.PORT || 2000;

// Assigning the variable app to express
const app = express();
app.set('trust proxy', 1); // Enable proxy trust for AWS ALB / NGINX / Cloudflare

// Creating HTTP server
const server = http.createServer(app);
app.use('/uploads', express.static(path.join(__dirname, './uploads')));

// Socket.io setup
const io = new Server(server, {
    cors: {
        origin: [
            'https://spintrip-admin.netlify.app', 
            'https://spintrip.in', 
            'http://localhost', 
            'http://localhost:3000',
            'http://localhost:4000',
            'http://13.232.236.183:3000', 
            'http://3.109.122.29:3000',
            'http://spintrip.in'
        ],
    },
});

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });
});

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

// Always log to Console for Docker/AWS CloudWatch streams
logger.add(new winston.transports.Console({
    format: winston.format.simple(),
}));

// Middleware
app.use(helmet());

// Prevent aggressive browser/proxy caching on dynamic API endpoints
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

app.use(cors({ 
    origin: [
        'https://spintrip-admin.netlify.app', 
        'https://spintrip.in', 
        'https://www.spintrip.in',
        'http://localhost', 
        'http://localhost:3000',
        'http://localhost:4000',
        'http://13.232.236.183:3000', 
        'http://3.109.122.29:3000',
        'http://spintrip.in',
        'http://www.spintrip.in'
    ],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(compression());
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 100 requests per windowMs
    validate: { xForwardedForHeader: false } // Force override AWS Proxy validation
});
app.use(limiter);

// Custom method for serving images from uploads
app.get('/uploads/:userId/:imageName', (req, res) => {
    const { userId, imageName } = req.params;
    const imagePath = path.join(__dirname, './uploads', userId, imageName);

    if (fs.existsSync(imagePath)) {
        res.sendFile(imagePath);
    } else {
        res.status(404).send('Image not found');
    }
});

app.get('/uploads/host/CarAdditional/:vehicleid/:imageName', (req, res) => {
    const { vehicleid, imageName } = req.params;
    const imagePath = path.join(__dirname, './uploads/host/CarAdditional', vehicleid, imageName);

    if (fs.existsSync(imagePath)) {
        res.sendFile(imagePath);
    } else {
        res.status(404).send('Image not found');
    }
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/host', hostRoutes);
app.use('/api/cab', cabRoutes);

// Synchronizing the database
db.sequelize.sync().then(() => {
    console.log('Database is connected');
    // initCronJobs(); // Start background tasks
});

// Default route
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Under Maintenance</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding-top: 50px; }
                .message { color: #ff6600; }
            </style>
        </head>
        <body>
            <div class="message">
                <h1>Our site is currently under maintenance.</h1>
                <p>We apologize for the inconvenience and appreciate your patience.</p>
            </div>
        </body>
        </html>
    `);
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled Exception: ' + err.stack);
    res.status(500).json({ message: 'Internal server error', error: process.env.NODE_ENV === 'production' ? 'Server exception occurred.' : err.message });
});

// Graceful shutdown handler
const shutdownHandler = async () => {
    console.log('\nGracefully shutting down...');
    try {
        await db.sequelize.close();
        console.log('Database connections successfully closed.');
    } catch (err) {
        console.error('Error closing database connections:', err);
    }
    
    server.close(() => {
        console.log('Server process terminated explicitly');
        process.exit(0);
    });
};

// Listening to server connection
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// Catch signals for shutdown
process.on('SIGTERM', shutdownHandler);
process.on('SIGINT', shutdownHandler);

// Global unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
    // Add logging or monitoring here if necessary
});

// Forced nodemon restart
// Freed port 2000 for nodemon
