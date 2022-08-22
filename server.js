const express = require("express");
const axios = require("axios");
const cors = require("cors");
const redis = require("redis");

// const redisClient = redis.createClient();
const redisClient = redis.createClient({
  legacyMode: true,
});
const DEFAULT_EXPIRATION = 3600;
const app = express();
app.use(cors());

// redisClient.on("error", (err) => console.log("Redis Client Error", err));
redisClient.connect();

// app.get("/photos", async (req, res) => {
//   const albumId = req.query.albumId;

//   await redisClient.get(
//     `photosData?albumId=${albumId}`,
//     async (error, photos) => {
//       if (error) console.log("error");
//       if (photos != null) {
//         console.log("redis hit");
//         return res.json(JSON.parse(photos));
//       } else {
//         console.log("redis miss");
//         const { data } = await axios.get(
//           "https://jsonplaceholder.typicode.com/photos",
//           { params: { albumId } }
//         );
//         await redisClient.setEx(
//           `photosData?albumId=${albumId}`,
//           DEFAULT_EXPIRATION,
//           JSON.stringify(data)
//         );
//         res.json(data);
//       }
//     }
//   );
// });

app.get("/photos", async (req, res) => {
  const albumId = req.query.albumId;

  const photos = await getOrSetCache(
    `photosData?albumId=${albumId}`,
    async () => {
      const { data } = await axios.get(
        "https://jsonplaceholder.typicode.com/photos",
        { params: { albumId } }
      );
      return data;
    }
  );
  res.json(photos);
});

const data_getter = async (req, res) => {
  const albumId = req.query.albumId;
  const { data } = await axios.get(
    "https://jsonplaceholder.typicode.com/photos",
    { params: { albumId } }
  );
  await redisClient.setEx("photos", DEFAULT_EXPIRATION, JSON.stringify(data));
  console.log("cashe hit 21");
  res.send(data);
};

const redis_gettter = async (req, res, next) => {
  //   await redisClient.connect();
  await redisClient.get("photos", (error, photos) => {
    console.log("cashe hit 28", photos);
    if (error) {
      console.log("cashe hit 30");
      console.log(error);
    }
    if (photos) {
      console.log("cashe hit 34");
      return res.send(JSON.parse(photos));
    } else {
      console.log("cashe hit 37");
      next();
    }
  });
};
// app.get("/photos", redis_gettter, data_getter);

app.get("/photos/:id", async (req, res) => {
  const photo = await getOrSetCache(`photosData:${req.params.id}`, async () => {
    const { data } = await axios.get(
      `https://jsonplaceholder.typicode.com/photos/${req.params.id}`
    );
    return data;
  });
  res.json(photo);
});

function getOrSetCache(key, cb) {
  return new Promise(async (resolve, reject) => {
    await redisClient.get(key, async (error, data) => {
      if (error) return reject(error);
      if (data != null) {
        console.log("redis hit");
        return resolve(JSON.parse(data));
      } else {
        console.log("redis miss");
        const freshData = await cb();
        await redisClient.setEx(
          key,
          DEFAULT_EXPIRATION,
          JSON.stringify(freshData)
        );
        resolve(freshData);
      }
    });
  });
}

app.listen(5050, () => console.log("Server Started"));
