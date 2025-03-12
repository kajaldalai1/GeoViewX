const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { parseString } = require("xml2js");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

const upload = multer({
    storage: multer.diskStorage({
        destination: "uploads/",
        filename: (req, file, cb) => {
            cb(null, file.originalname);
        },
    }),
    fileFilter: (req, file, cb) => {
        if (!file.originalname.endsWith(".kml")) {
            return cb(new Error("Invalid file type"));
        }
        cb(null, true);
    },
});

// Function to parse KML file
const parseKML = (kmlData) => {
    return new Promise((resolve, reject) => {
        parseString(kmlData, (err, result) => {
            if (err) {
                return reject("Error parsing KML.");
            }

            if (!result.kml) {
                return reject("Invalid KML structure. No <kml> tag found.");
            }

            // Extract Placemark from different possible locations
            let placemarks = result.kml.Document?.[0]?.Placemark || 
                             result.kml.Folder?.[0]?.Placemark || 
                             result.kml.Placemark || []; // Handle direct root-level Placemark

            if (!Array.isArray(placemarks) || placemarks.length === 0) {
                return reject("No Placemark data found.");
            }

            const summary = {};
            const details = [];

            placemarks.forEach((placemark) => {
                const type = placemark.LineString
                    ? "LineString"
                    : placemark.MultiGeometry
                    ? "MultiLineString"
                    : "Point";

                summary[type] = (summary[type] || 0) + 1;

                if (type !== "Point" && placemark.LineString) {
                    const coords =
                        placemark.LineString[0]?.coordinates?.[0]
                            ?.trim()
                            ?.split(" ") || [];
                    const totalLength = coords.length;
                    details.push({ type, totalLength });
                }
            });

            resolve({ summary, details, placemarks });
        });
    });
};


// Upload KML file and parse it
app.post("/upload", upload.single("file"), async (req, res) => {
    console.log("Uploaded file:", req.file); 
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    try {
        const kmlData = fs.readFileSync(req.file.path, "utf-8");

        const parsedData = await parseKML(kmlData); // Ensure `parseKML` properly extracts data

        return res.json(parsedData);
    } catch (error) {
        console.error("Parsing error:", error);
        return res.status(400).json({ error: error.toString() });
    }
});

app.listen(5000, () => console.log("Server running on port 5000"));
