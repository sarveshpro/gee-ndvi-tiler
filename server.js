// Require client library and private key.
var ee = require("@google/earthengine");
const express = require("express");
const router = express.Router();
const cors = require("cors");
var privateKey = require("./privatekey.json");
const port = process.env.PORT || 8000;

app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

app.get("/", (req, res) =>
  res.status(200).json({
    status: 200,
    message: "Health check successful",
  })
);

// Define endpoint at /mapid.
app.use(
  router.post("/vegetation-change", async (req, res, next) => {
    try {
      console.log("request from - " + req.get("origin"));
      // ... run analysis ...
      const sitePolygon = ee.FeatureCollection(req.body);
      const Image2016 = ee
        .Image(
          "users/laubert/PlanetForMonitoring/PlantForThePlanet/20161120_154530_0e0e_3B_AnalyticMS_SR"
        )
        .clip(sitePolygon);
      const Image2019_prep1 = ee.Image(
        "users/laubert/PlanetForMonitoring/PlantForThePlanet/20191117_150912_1048_3B_AnalyticMS_SR"
      );
      const Image2019_prep2 = ee.Image(
        "users/laubert/PlanetForMonitoring/PlantForThePlanet/20191117_150913_1048_3B_AnalyticMS_SR"
      );
      const Image2019 = ee
        .ImageCollection([Image2019_prep1, Image2019_prep2])
        .mosaic()
        .clip(sitePolygon);
      const nir2016 = Image2016.select(3);
      const red2016 = Image2016.select(0);
      const ndvi2016 = nir2016
        .subtract(red2016)
        .divide(nir2016.add(red2016))
        .rename("NDVI");
      const nir2019 = Image2019.select(3);
      const red2019 = Image2019.select(0);
      const ndvi2019 = nir2019
        .subtract(red2019)
        .divide(nir2019.add(red2019))
        .rename("NDVI");
      const ndvi2016_normalized = ndvi2016.divide(
        ee.Number(
          ndvi2016
            .reduceRegion({
              reducer: ee.Reducer.mean(),
              geometry: sitePolygon,
              bestEffort: true,
            })
            .get("NDVI")
        )
      );
      const ndvi2019_normalized = ndvi2019.divide(
        ee.Number(
          ndvi2019
            .reduceRegion({
              reducer: ee.Reducer.mean(),
              crs: "EPSG:32615",
              geometry: sitePolygon,
              crsTransform: [3, 0, 795915, 0, -3, 2082393],
              bestEffort: true,
            })
            .get("NDVI")
        )
      );
      const ndviN_2016_2019 = ndvi2019_normalized
        .subtract(ndvi2016_normalized)
        .gt(0.05)
        .selfMask();
      const mapId = await ndviN_2016_2019.getMap({
        min: -0.5,
        max: 0.5,
        palette: ["FF0000", "FFFFFF", "00FF00"],
      });
      res.status(200).json({ data: mapId.urlFormat });
      console.log("response sent - " + mapId.urlFormat);
    } catch (err) {
      next(err);
    }
  })
);

// Initialize ee library and run analysis.
var runAnalysis = function () {
  ee.initialize(
    null,
    null,
    function () {
      console.log("Earth Engine library initialized.");
      //Start Server
      app.listen(port);
      console.log(`Listening on port ${port}`);
    },
    function (e) {
      console.error("Initialization error: " + e);
    }
  );
};

// Authenticate using a service account.
ee.data.authenticateViaPrivateKey(privateKey, runAnalysis, function (e) {
  console.error("Authentication error: " + e);
});
