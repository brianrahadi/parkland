require("dotenv").config();
var cors = require("cors");
var validator = require("email-validator");
var moment = require("moment");
var fs = require('fs');
var multer = require('multer');
const emailValidator = require("deep-email-validator");
//const nodeFetch = require("node-fetch");
const express = require("express");
const path = require("path");
const PORT = process.env.PORT || 5000;
const session = require("express-session");
const { Pool } = require("pg");
const { waitForDebugger } = require("inspector");
var pool;
pool = new Pool({
  connectionString: process.env.DATABASE_URL_1,
});

const testingCode = process.env.TEST;

invalid_login = { value: "0", loggedIn: false };
invalid_username = { taken: 0 };
invalid_email = { taken: 0 };
forgotPsw = { state: 0 };

var app = express();
app.use(express.json());
app.use(
  session({
    name: "session",
    secret: "zordon",
    resave: false,
    saveUninitialized: false,
    maxAge: 30 * 60 * 1000, // 30 minutes
  })
);
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");


const stripePublicKey = 'pk_test_51LSEnbIl2tbMd0KFXpDidTCA4SWS7kgNWyhSySmlFYptYWmv9ADm05WzaPRJXVA3JqOiuPHSZWJpMjd652dCtwIq00gO0F8t86'
const stripeSecretKey = 'sk_test_51LSEnbIl2tbMd0KF19xIGHc7VqPtQtwGwwSJSoILQb1aU3oPff85qsGAFisK7639fcb9inLDrobCwFG7ciAiumQK00ktqzMQWG'

var SibApiV3Sdk = require('sib-api-v3-sdk');
const { type } = require("os");
var defaultClient = SibApiV3Sdk.ApiClient.instance;
var apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.API_KEY;

var storage = multer.diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
      cb(null, file.fieldname + '-' + Date.now()+ path.extname(file.originalname))
  }
});

var upload = multer({ storage: storage })
const { ImgurClient } = require('imgur');
const client = new ImgurClient({ clientId: '980ce49e5e5acc2' });


const stripe = require('stripe')(stripeSecretKey)

app.post('/upload-image', upload.single('image')  ,async (req,res) => {

  // upload multiple images via fs.createReadStream (node)
  const response = await client.upload({
    image: fs.createReadStream(path.join(__dirname + '/uploads/' + req.file.filename)),
    type: 'stream',
  });
  res.json({link: response.data.link})
})

app.post('/user-api/stripe', async (req,res) => {
  console.log(req.body.amount)
  amount = req.body.amount 
  
  var old_balance = req.body.old_balance
  console.log(old_balance)
  var new_balance = parseFloat(old_balance) + parseFloat(amount);
  var cid = parseInt(req.body.cid)
  console.log("CID:")
  console.log(cid)
  console.log("NEW BALANCe")
  console.log(new_balance)
  var cardBalancequery = `update cards set balance = '${new_balance}' where cid = '${cid}' `;

  console.log(amount)
  cid = req.body.cid
  stripe.customers.create({
    email: req.body.stripeEmail,
    source:req.body.stripeToken,
    name:'Tester',
    address:{
      line1: '1234 burnaby street',
      postal_code: 'v5p3p3',
      city:'Buranby',
      state:'bc',
      country:'canada'
    }
  })
  .then((customer) => {
    return stripe.charges.create({
      amount: amount*100,
      description: cid,
      currency: 'USD',
      customer:customer.id
    })
  })
  .then((charge)  => {
    console.log(charge)
    try {
      console.log(cardBalancequery)
      pool.query(cardBalancequery)
      topBalanceLog(cid, amount, new_balance, '-credit-')
    } catch(err) {
      res.send(err)
    }

    res.render("pages/paymentsuccess.ejs", {amount: amount, cid: cid, new_balance: new_balance})
  }) .catch((err) => {
    res.send(err)
  })
  
})


async function isEmailValid(email) {
  // console.log(email);
  result = emailValidator.validate(email);
  return result;
}

function randomString(length) {
  let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  let str = "";
  for (let i = 0; i < length; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return str;
}

async function verifyEmail(recip, str) {
  
  stext = "Your password is ";
  //const { valid, reason, validators } = await isEmailValid(recip);
  if (str == "") {
    str = randomString(15, 20);
    stext = "Please verify your email address. Use this token as a code: ";
  }
  var apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  var sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail(); // SendSmtpEmail | Values to send a transactional email

  sendSmtpEmail = {
    sender: { email: "parkckaland.noreply@gmail.com" },
    to: [
      {
        email: recip,
        name: "Person Name",
      },
    ],
    subject: "Test Email",
    textContent: stext + str ,
  };

  apiInstance.sendTransacEmail(sendSmtpEmail).then(
    function (data) {
      console.log("API called successfully. Returned data: " + data);
    },
    function (error) {
      console.error(error);
    }
  );

  return str;
}

app.get("/verifyKids/:id", async (req, res) => {
  
  if(req.session.token){
    var id = req.params.id;
    const result = await pool.query(`select * from verRequest where uid = ${id};`)
    if(result.rows.length == 0){
      res.render("pages/verifyKids", {info: req.session.token, request: result.rows})
    }
    else if(result.rows[0].status == 'approved'){
      res.render("pages/kidssuccess", {info: req.session.token})
    }
    else if(result.rows[0].status == 'rejected'){
      var getKidsQuery = `select * from children  where uid = ${id}`
      console.log(request.rows[0])
      kids = await pool.query(getKidsQuery);
      kids.rows.forEach(function(k){
        k.dob = moment(k.dob).format('YYYY-MM-DD')
      })
      console.log(kids.rows)
      res.render("pages/verifyKids.ejs", {
        info: req.session.token,
        kids: kids.rows,
        request: result.rows
      });

    }
    else if(result.rows[0].status == 'requested'){
      var getReqQuery = `select * from verRequest where uid = ${id}`
      var getKidsQuery = `select * from children  where uid = ${id}`
      request = await pool.query(getReqQuery);
      console.log(request.rows[0])
      kids = await pool.query(getKidsQuery);
      kids.rows.forEach(function(k){
        k.dob = moment(k.dob).format('YYYY-MM-DD')
      })
      console.log(kids.rows)
      res.render("pages/verifyKidsAdmin.ejs", {
        loggedIn: true,
        info: req.session.token,
        kids: kids.rows,
        request: request.rows[0]
      });
    }   
  }
})



app.post("/verifyKids", upload.single('image'), async (req, res) => {
  if(req.session.token){
    console.log(req.file)
    const num = req.body.kidsNum;
    const uid = req.session.token.uid;
    const passNum = req.body.passNum;
    fn = req.body.fname
    ln = req.body.lname
    dob = req.body.dob;
    console.log(dob);
    const result = await pool.query(`select * from verRequest where uid = ${uid};`)
    if(result.rows.length != 0){
      await pool.query(`delete from verRequest where uid = ${uid};`)
      await pool.query(`delete from children where uid = ${uid};`)
    }
    const response = await client.upload({
      image: fs.createReadStream(path.join(__dirname + '/uploads/' + req.file.filename)),
      type: 'stream',
    });
    
    var addReqQuery = `INSERT INTO verRequest (uid, passport, dob, status, passPhoto, fname, lname, kids) VALUES (${uid}, ${passNum}, '${dob}' , 'requested','${response.data.link}', '${fn}', '${ln}', ${num})`
    await pool.query(addReqQuery);
    for(i=1; i<=num;i++){
      var code_fn = 'fn' + i.toString();
      var code_ln = 'ln' + i.toString();
      var code_dob = 'dob' + i.toString();
      fn = req.body[code_fn]
      ln = req.body[code_ln]
      dob = req.body[code_dob]
      var addKidQuery = `INSERT INTO children (uid, fname, lname, dob) VALUES (${uid}, '${fn}', '${ln}', '${dob}')`
      await pool.query(addKidQuery);
    }
    console.log(response.data.link);
    res.redirect(`/dashboard/${uid}`);
  }
})



app.post("/verifyAdmin", async (req, res) => {
  const uid = req.body.uid;
  const aid = req.session.token.uid
  const num = req.body.kidsNum;
  fn = req.body.fname
  ln = req.body.lname
  const getBalance = `select balance from users where uid=${uid}`
  const result = await pool.query(getBalance)
  const old_balance = result.rows[0].balance;
  var balance = old_balance + 50*num;
  var updateUserQuery = `UPDATE users SET f_name='${fn}', l_name='${ln}', kids=${num}, balance = ${balance} WHERE uid=${uid}`
  var addReqQuery = `update verRequest set status = 'approved' where uid = ${uid} `
  await pool.query(updateUserQuery);
  await pool.query(addReqQuery);
  res.redirect(`/admin/${aid}`);

})

app.post("/reject_request", async (req, res) => {
  const uid = req.body.uid;
  const aid = req.session.token.uid
  const num = req.body.kidsNum;
  
  var addReqQuery = `update verRequest set status = 'rejected' where uid = ${uid}`
  await pool.query(addReqQuery);
  res.redirect(`/admin/${aid}`);
})


app.get("/get_request/:id", async (req, res) => {
  var uid = req.params.id;

  if (req.session.token || req.body.type == testingCode) {
    if (req.session.token.access == "admin" || req.body.type == testingCode) {
      var getReqQuery = `select * from verRequest where uid = '${uid}'`
      var getKidsQuery = `select * from children  where uid = '${uid}'`
      request = await pool.query(getReqQuery);
      console.log(request.rows[0])
      kids = await pool.query(getKidsQuery);
      kids.rows.forEach(function(k){
        k.dob = moment(k.dob).format('YYYY-MM-DD')
      })
      console.log(kids.rows)
      res.render("pages/verifyKidsAdmin.ejs", {
        loggedIn: true,
        info: req.session.token,
        kids: kids.rows,
        request: request.rows[0]
      });
      console.log("rendered")
    }
    else{
      res.redirect(`/admin/${uid}`);
    }
  }
  else{
    res.redirect("/login");
  }
})



// start of Danny's code for Weather API
app.get("/weather", (req, res) => {
  var request = require("request");
  request(
    `https://api.openweathermap.org/data/2.5/weather?q=vancouver&appid=b9b53f4273f041970a7bbc79b250ccaf`,
    function(error, response, body) {
      let data = JSON.parse(body);
      if (response.statusCode === 200) {
        current = data.weather;
        weather = current[0].description.toString();
        // console.log(data)
        temp = (data.main.temp - 273.15).toFixed(2);
        feels_like = (data.main.feels_like - 273.15).toFixed(2);
        humidity = data.main.humidity;
        visibility = data.visibility;
        wind = data.wind.speed;
        if (req && req.session && req.session.token) {
          res.render("pages/weather", {
            weather: weather,
            temp: temp,
            feels_like: feels_like,
            visibility: visibility,
            humidity: humidity,
            wind: wind,
            loggedIn: true,
            info: req.session.token,
          });
        } else {
          res.render("pages/weather", {
            weather: weather,
            temp: temp,
            feels_like: feels_like,
            visibility: visibility,
            humidity: humidity,
            wind: wind,
            loggedIn: false,
          });
        }
      }
    }
  );
});

app.get("/forgotPsw", (req, res) => {
  if (req && req.session && req.session.token) {
    res.render("pages/forgotPsw", {
      loggedIn: true,
      info: req.session.token,
      forgotPsw: forgotPsw,
    });
    forgotPsw.state = 0;
  } else {
    res.render("pages/forgotPsw", { loggedIn: false, forgotPsw: forgotPsw });
    forgotPsw.state = 0;
  }
});
app.get("/aboutus", (req, res) => {
  if (req && req.session && req.session.token) {
    res.render("pages/aboutus", { loggedIn: true, info: req.session.token });
  } else {
    res.render("pages/aboutus", { loggedIn: false });
  }
});
app.get("/careers", (req, res) => {
  if (req && req.session && req.session.token) {
    res.render("pages/careers", { loggedIn: true, info: req.session.token });
  } else {
    res.render("pages/careers", { loggedIn: false });
  }
});
app.get("/privacypolicy", (req, res) => {
  if (req && req.session && req.session.token) {
    res.render("pages/privacypolicy", {
      loggedIn: true,
      info: req.session.token,
    });
  } else {
    res.render("pages/privacypolicy", { loggedIn: false });
  }
});
app.get("/forum", (req, res) => {
  if (req && req.session && req.session.token) {
    res.render("pages/forum", { loggedIn: true, info: req.session.token });
  } else {
    res.render("pages/forum", { loggedIn: false });
  }
});
app.get("/contactus", (req, res) => {
  if (req && req.session && req.session.token) {
    res.render("pages/contactus", { loggedIn: true, info: req.session.token });
  } else {
    res.render("pages/contactus", { loggedIn: false });
  }
});
app.get("/addcreditcard", async (req, res) => {
  if (req && req.session && req.session.token) {
    console.log("WOW", info);
    res.render("pages/addcreditcard", {
      loggedIn: true,
      info: req.session.token,
    });
  } else if (req.body.type == testingCode) {
    console.log(";po;l")
    var verifyQuery = `SELECT * FROM users WHERE username='${req.body.username}' AND password='${req.body.password}'`;
    var result = await pool.query(verifyQuery);
    res.render("pages/addcreditcard", {
      loggedIn: true,
      info: result.rows[0],
    });
  } else {
    res.redirect("/"); // will not allow you to access this page
  }
});
// end of Danny's code

// renders reviews page
app.get("/rides", async (req, res) => {
  let selectAllRidesQuery = `SELECT * FROM ride ORDER BY rideid`
  let ridesResult = await pool.query(selectAllRidesQuery);

  let rides = ridesResult.rows;
  // 
  if (req && req.session && req.session.token) {
    res.render("pages/reviews", { loggedIn: true, info: req.session.token, rides: rides });
  } else {
    res.render("pages/reviews", { loggedIn: false, rides: rides });
  }
});

// render rides page
app.get("/rides/:id", async (req, res) => {
  let selectRideQuery = `SELECT * FROM ride WHERE rideId=${req.params.id}`
  let rideResult = await pool.query(selectRideQuery);

  let ride = rideResult.rows[0];

  let selectReviewsQuery = `SELECT uid, username, rating, comment, likes, dislikes, counter FROM user_reviews_ride JOIN users ON users.uid = user_reviews_ride.userid WHERE rideId=${req.params.id} ORDER BY counter ASC`
  let reviewResult = await pool.query(selectReviewsQuery);
  let reviews = reviewResult.rows;

  // tb deleted
  let canReview = false;
  
  if (req.session && req.session.token) {
    let checkIfUserHasReviewed = `SELECT * FROM user_reviews_ride WHERE rideId=${req.params.id} AND userId=${req.session.token.uid}`
    let result = await pool.query(checkIfUserHasReviewed);
    if (result.rows.length == 0) {
      canReview = true;
    }
  }


  if (req && req.session && req.session.token) {
    res.render("pages/ride", {
      id: req.params.id,
      loggedIn: true,
      info: req.session.token,
      ride: ride,
      reviews: reviews,
      canReview: canReview
    });
  } else {
    res.render("pages/ride", { id: req.params.id, loggedIn: false, ride: ride, reviews: reviews, canReview: canReview, info: undefined});
  }
});

// render rides add review page
app.get("/rides/:id/addreview", async (req, res) => {
  // initial checking to ensure that if user has logged in, the user must have not added review for this ride
  if (!(req.session && req.session.token) && req.body.type != testingCode) {
    res.redirect(`/rides/${req.params.id}`);
    return;
  }

  let selectRideQuery = `SELECT * FROM ride WHERE rideId=${req.params.id}`
  let rideResult = await pool.query(selectRideQuery);
  let ride = rideResult.rows[0];

  if (req.body.type == testingCode) {
    res.json(ride);
    return;
  }
  res.render("pages/addreview", {
    id: req.params.id,
    loggedIn: true,
    info: req.session.token,
    ride: ride
  });

});

// render rides add review page
app.post("/rides/:id/addreview", async (req, res) => {
  let rideId = req.params.id;
  if (!(req.session && req.session.token) && req.body.type != testingCode) {
    res.redirect(`/rides/${rideId}`)
    return;
  } 

  if (req.body.type == testingCode) {
    let result = {};
    if (typeof req.body.username == "undefined") {
      // this means not logged in
      result.message = "Failure to add review. User not logged in!"
    } else {
      let { rating, comment, uid, username, password } = req.body; // rating = req.body.rating, comment = req.body.comment;

      let addReviewQuery = `INSERT INTO user_reviews_ride (userId, rideId, rating, comment, likes, dislikes) VALUES (${uid}, ${rideId}, ${rating}, '${comment}', 0, 0) RETURNING counter, comment, rating`;

      try {
        result = await pool.query(addReviewQuery); // no store to result since this is just setters, not getters.
      } catch (error) {
        res.end(error);
      }
    }
    res.json(result);
    return;
  }
  
  let info = req.session.token;

  let { rating, comment } = req.body; // rating = req.body.rating, comment = req.body.comment;
  let addReviewQuery = `INSERT INTO user_reviews_ride (userId, rideId, rating, comment, likes, dislikes) VALUES (${info.uid}, ${rideId}, ${rating}, '${comment}', 0, 0)`
  try {
    await pool.query(addReviewQuery); // no store to result since this is just setters, not getters.
  } catch (error) {
    res.end(error);
  }

  res.redirect(`/rides/${rideId}`)
});

// render rides update review page
app.get("/rides/:rideid/updatereview/:counter", async (req, res) => {
  if (!(req.session && req.session.token) && req.body.type != testingCode) {
    res.redirect(`/rides/${req.params.rideid}`);
    return;
  }
  let reviewResult;

  let findUidQuery = `SELECT userid FROM user_reviews_ride WHERE counter=${req.params.counter}`;
  let uid;
  try {
    let uidResult = await pool.query(findUidQuery);
    uid = uidResult.rows[0].userid;
  } catch (error) {
    res.end(error);
  }

  if (req.body.type == testingCode) {
    let findReviewQuery = `SELECT * FROM user_reviews_ride WHERE counter=${req.params.counter} AND userid=${uid}`
    try {
      reviewResult = await pool.query(findReviewQuery);
    } catch (error) {
      res.end(error);
    }
    let review = reviewResult.rows[0];

    let selectRideQuery = `SELECT * FROM ride WHERE rideId=${req.params.rideid}`
    let rideResult;
  
    try {
      rideResult = await pool.query(selectRideQuery);
    } catch (error) {
      res.end(error);
    }
    let ride = rideResult.rows[0];
    res.json({ review, ride });
    return;
  }

  if (uid != req.session.token.uid && req.session.token.access == 'user') {
    res.send(`${uid} ERROR! You are not supposed to access this page! This is because you have not submitted any review!`)
    return;
  }

  let findReviewQuery = `SELECT * FROM user_reviews_ride WHERE counter=${req.params.counter} AND userid=${uid}`
  try {
    reviewResult = await pool.query(findReviewQuery);
  } catch (error) {
    res.end(error);
  }

  let review = reviewResult.rows[0];

  let selectRideQuery = `SELECT * FROM ride WHERE rideId=${req.params.rideid}`
  let rideResult;

  try {
    rideResult = await pool.query(selectRideQuery);
  } catch (error) {
    res.end(error);
  }
  let ride = rideResult.rows[0];

  let info = req.session.token;

  // in here, this means access must be admin
  if (uid != req.session.token.uid) {
    let findUserQuery = `SELECT * FROM users WHERE uid=${uid}`
    try {
      let userResult = await pool.query(findUserQuery);
      info = userResult.rows[0];
    } catch (error) {
      res.end(error);
    }
  }

  res.render("pages/updatereview", {
    id: req.params.id,
    loggedIn: true,
    info: info,
    ride: ride,
    review: review
  });
});

// post rides update review page
app.post("/rides/:rideid/updatereview/:counter", async (req, res) => {
  let rideId = req.params.rideid;
  let counter = req.params.counter;
  if (!(req.session && req.session.token) && req.body.type != testingCode) {
    res.redirect(`/rides/${rideId}`)
    return;
  } 

  if (req.body.type == testingCode) {
    let result = {};
    if (typeof req.body.username == "undefined") {
      // this means not logged in
      result.message = "Failure to update review. User not logged in!"
    } else {
      let { rating, comment, uid, username, password } = req.body; // rating = req.body.rating, comment = req.body.comment;
      
      let verificationQuery = `SELECT uid from users WHERE username='${username}' AND password='${password}'`
      let verified = false;
      try {
        let verificationQueryResult = await pool.query(verificationQuery); 
        if (verificationQueryResult.rows.length == 1 && verificationQueryResult.rows[0].uid == uid) {
          verified = true;
        } else {
          result.message = "Failure to update review. User logged in but does not have access!"
        }
      } catch (error) {
        res.end(error);
      }
      if (verified) {
        let updateReviewQuery = `UPDATE user_reviews_ride SET rating=${rating}, comment='${comment}' WHERE counter=${counter} RETURNING counter, comment, rating`
        try {
          result = await pool.query(updateReviewQuery); // no store to result since this is just setters, not getters.
        } catch (error) {
          res.end(error);
        }
      }

    }
    res.json(result);
    return;
  }
  let { rating, comment } = req.body; // rating = req.body.rating, comment = req.body.comment;

  let updateReviewQuery = `UPDATE user_reviews_ride SET rating=${rating}, comment='${comment}' WHERE counter=${counter}`
  try {
    await pool.query(updateReviewQuery); // no store to result since this is just setters, not getters.
  } catch (error) {
    res.end(error);
  }

  res.redirect(`/rides/${rideId}`)
});


// post rides update review page
app.post("/rides/:rideid/deletereview/:counter", async (req, res) => {
  let rideId = req.params.rideid;
  let counter = req.params.counter;
  if (!(req.session && req.session.token) && req.body.type != testingCode) {
    res.redirect(`/rides/${rideId}`)
    return;
  } 

  if (req.body.type == testingCode) {
    let result = {};
    if (typeof req.body.username == "undefined") {
      // this means not logged in
      result.message = "Failure to delete review. User not logged in!"
    } else {
      let { uid, username, password } = req.body; // rating = req.body.rating, comment = req.body.comment;

      let verificationQuery = `SELECT uid from users WHERE username='${username}' AND password='${password}'`
      let verified = false;

      try {
        let verificationQueryResult = await pool.query(verificationQuery); 
        if (verificationQueryResult.rows.length == 1 && verificationQueryResult.rows[0].uid == uid) {
          verified = true;
        } else {
          result.message = "Failure to delete review. User logged in but does not have access!"
        }
      } catch (error) {
        res.end(error);
      }


      if (verified) {
        let deleteReviewQuery = `DELETE FROM user_reviews_ride WHERE counter=${counter}`
      
        try {
          result = await pool.query(deleteReviewQuery); // no store to result since this is just setters, not getters.
          result.message = "Review successfully deleted!"
        } catch (error) {
          res.end(error);
        }
      }
    }
    res.json(result);
    return;
  }

  let deleteReviewQuery = `DELETE FROM user_reviews_ride WHERE counter=${counter}`

  try {
    await pool.query(deleteReviewQuery); // no store to result since this is just setters, not getters.
  } catch (error) {
    res.end(error);
  }
  res.redirect(`/rides/${rideId}`)
});


//renders home page
app.get("/", (req, res) => {
  if (req && req.session && req.session.token) {
    res.render("pages/index", { loggedIn: true, info: req.session.token });
  } else {
    res.render("pages/index", { loggedIn: false });
  }
});

//renders login page
app.get("/login", (req, res) => {
  res.render("pages/singin", invalid_login);
});

//renders sign up page
app.get("/adduser", (req, res) => {
  res.render("pages/adduser", invalid_username);
  invalid_username.taken = 0;
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));

//signs up a new user
app.post("/user-api/adduser", async (req, res) => {
  var usern = req.body.uname;
  var email = req.body.email;
  var pw = req.body.password;
  var offer = req.body.offer;
  var f_name = req.body.f_name;
  var l_name = req.body.l_name;
  var status = ""
  
  if(email != ''){
   status = await verifyEmail(email, "");
  }

  if (offer == "on") {
    offer = 1;
  } else {
    offer = 0;
  }
  // put person in the database
  // console.log(offer)
  var cardinsertquery = `INSERT INTO users (f_name, l_name, username, email, password, access, get_prom, kids, status) VALUES ('${f_name}','${l_name}','${usern}', '${email}', '${pw}', 'user', '${offer}', '0', '${status}');`;
  try {
    const result = await pool.query(cardinsertquery);
    var ret_obj = { username: usern, password: pw };
    res.redirect("/login");
  } catch (error) {
    invalid_username.taken = 1;
    res.redirect("/adduser");
  }
});

//updates user's info
app.post("/user-api/updateuser/:id", async (req, res) => {
  var email = req.body.email;
  var f_name = req.body.f_name;
  var l_name = req.body.l_name;
  var offer = req.body.offer;
  if (offer == "on") {
    offer = 1;
  } else {
    offer = 0;
  }
  var userupdatequery = `UPDATE users SET email='${email}', f_name='${f_name}', l_name='${l_name}', get_prom='${offer}' WHERE uid=${req.params.id}`;

  try {
    const result = await pool.query(userupdatequery);
    if (req.session.token) {
      req.session.token.email = email;
      req.session.token.f_name = f_name;
      req.session.token.l_name = l_name;
      req.session.token.get_prom = offer;
    }

    let pathLink = req.body.access == "user" ? "dashboard" : "admin";
    res.redirect(`/${pathLink}/${req.params.id}`);
  } catch (error) {
    console.log(error);
  }
});

async function newCardLog(cid){
  var insertLog = `insert into card_log (cid_prim, type, prim_balance) values ('${cid}', '-new-', 0)`
  await pool.query(insertLog);
}

//adds payment card on user's request+
app.post("/user-api/addcard", async (req, res) => {
  var id = req.body.uid;
  var cardinsertquery = `INSERT INTO cards (owner, cname, balance, spent_amount) VALUES ('${id}', 'My_Card', '0', '0')`;
  var showLargestId = `SELECT MAX(cid) from cards`;
  if (req.body.type == testingCode) {
    const result = await pool.query(cardinsertquery);
    result.message = "Card successfully added";
    // we do not use result for display because first result is just an insert (setters, not getters)

    const showLatestCard = `SELECT * FROM cards WHERE cid = (SELECT MAX(cid) from cards where owner=${id})`
    const result2 = await pool.query(showLatestCard);
    res.json(result2);
    return;
  }
  try {
    await pool.query(cardinsertquery);
    const result = await pool.query(showLargestId);
    await newCardLog(result.rows[0].max)
    res.redirect(`/dashboard/${id}`);
  } catch (error) {
    res.end(error);
  }
});

async function cardNameLog(new_name, cid, balance){
  var insertLog = `insert into card_log (cid_prim, type, prim_balance) values ('${cid}', '${new_name}', '${balance}' )`
  await pool.query(insertLog);
}

app.post("/card/name_change", async (req, res) => {
  var new_name = req.body.name;
  var cid = parseInt(req.body.cid);
  
  // console.log(new_name, cid)
  var cardnamequery = `update cards set cname = '${new_name}' where cid = '${cid}' `;

  if (req.body.type == testingCode) {
    try {
      const result = await pool.query(cardnamequery);
      result.message = "Card successfully updated"
      res.json(result);
      return;
    } catch (error) {
      res.end(error);
    }
  }

  try {
    const result = await pool.query(cardnamequery);
    index = req.session.token.cards.findIndex((x) => x.cid == cid);
    req.session.token.cards[index].cname = new_name;
    balance = req.session.token.cards[index].balance
    cardNameLog(new_name, cid, balance)
    res.redirect(`/card/${cid}`);
  } catch (error) {
    res.end(error);
  }
});

async function topBalanceLog(cid, amount, balance, type){
  var insertLog = `insert into card_log (cid_prim, type, transfer, prim_balance) values ('${cid}','${type}', '${amount}', '${balance}' )`
  await pool.query(insertLog);
}

app.post("/card/top_balance", async (req, res) => {
  var cid = req.body.cid;
  index = req.session.token.cards.findIndex((x) => x.cid == cid);
  var old_balance = req.session.token.cards[index].balance;
  var new_balance = parseInt(old_balance) + parseInt(req.body.amount);
  var cardBalancequery = `update cards set balance = '${new_balance}' where cid = '${cid}' `;
  try {
    const result = await pool.query(cardBalancequery);
    req.session.token.cards[index].balance = new_balance;
    topBalanceLog(cid,req.body.amount, new_balance, '-credit-')
    res.redirect(`/card/${cid}`);
  } catch (error) {
    res.end(error);
  }
});

async function transferBalanceLog(cid1, cid2, amount, balance1, balance2){
  var insertLog = `insert into card_log (cid_prim, cid_sec, type, transfer, prim_balance, sec_balance) values ('${cid1}','${cid2}','-transfer-', '${amount}', '${balance1}', '${balance2}' )`
  await pool.query(insertLog);
}

app.post("/transfer", async (req, res) => {
  var id1 = req.body.card1;
  var id2 = req.body.card2;
  const uid = req.session.token.uid
  if (id1 != id2) {
    if(id1 == -1){
      bal1 = req.session.token.balance
    }
    else{
      var index1 = req.session.token.cards.findIndex((x) => x.cid == id1);
      var bal1 = parseInt(req.session.token.cards[index1].balance);
    }
    if(id2==-1){
      bal2 = req.session.token.balance
    }
    else{
      var index2 = req.session.token.cards.findIndex((x) => x.cid == id2);
      var bal2 = parseInt(req.session.token.cards[index2].balance);
    }
   
    console.log(bal1, bal2);
    var amount = parseInt(req.body.amount);

    bal1 -= amount;
    bal2 += amount;

    console.log(bal1, bal2);
    if(id1==-1){
      cardBalancequery1 = `update users set balance = ${bal1} where uid = '${uid}'`
    }
    else{
      var cardBalancequery1 = `update cards set balance = '${bal1}' where cid = '${id1}' `;
    }
    if(id2==-1){
      cardBalancequery2 = `update users set balance = ${bal2} where uid = '${uid}'`
    }
    else{
      var cardBalancequery2 = `update cards set balance = '${bal2}' where cid = '${id2}' `;
    }

    await pool.query(cardBalancequery1);
    await pool.query(cardBalancequery2);

    transferBalanceLog(id1, id2, amount, bal1, bal2)

    if(id1==-1){req.session.token.balance = bal1;}
    else{req.session.token.cards[index1].balance = bal1;}
    
    if(id2==-1){req.session.token.balance = bal2;}
    else{req.session.token.cards[index2].balance = bal2;}
    
  }

  res.redirect(`/dashboard/${req.session.token.uid}`);
});

//deletes payment card on user's request
app.post("/user-api/deletecard", async (req, res) => {
  var cid = req.body.cid;
  var uid = req.body.uid;
  index = req.session.token.cards.findIndex((x) => x.cid == cid);
  var card_balance = req.session.token.cards[index].balance;
  var old_balance = req.session.token.balance;
  var new_balance = card_balance + old_balance
  req.session.token.balance = new_balance
  // console.log(cid, uid)
  var updateBalance = `update users set balance = ${new_balance} where uid = ${uid}`
  var deletecardquery = `delete from cards where cid = '${cid}' `;
  try {
    const result = await pool.query(deletecardquery);
    await pool.query(updateBalance)
    if (req.body.type == testingCode) {
      result.message = "Card successfully deleted";
      res.json(result);
      return
    }
    res.redirect(`/dashboard/${uid}`);
  } catch (error) {
    res.end(error);
  }
});
var paypal = require('paypal-rest-sdk');
const { parse } = require("path");

paypal.configure({
  'mode': 'sandbox', //sandbox or live
  'client_id': process.env.PAYPAL_PUBLIC_KEY,
  'client_secret': process.env.PAYPAL_SECRET_KEY
});

// sends uid and cid check out page 
app.post("/user-api/topbalance", async (req, res) => {
  var cid = req.body.cid;
  var uid = req.body.uid;
  index = req.session.token.cards.findIndex((x) => x.cid == cid);
  var old_balance = req.session.token.cards[index].balance;
  
  try {
    res.render("pages/checkout.ejs", {uid: uid, cid: cid, old_balance: old_balance})
  } catch (error) {
    res.end(error)
  }
})



app.post("/user-api/pay", async (req, res) => {
  var cid = req.body.cid;
  var uid = req.body.uid;
  var old_balance = req.body.old_balance;
  const amount = req.body.amount;
  
  const create_payment_json = {
    "intent": "sale",
    "payer": {
        "payment_method": "paypal"
    },
    "redirect_urls": {
        "return_url":  process.env.RETURN_URL,
        "cancel_url": process.env.CANCEL_URL
        // "return_url":  "http://localhost:5000/user-api/paymentsuccess",
        // "cancel_url": "http://localhost:5000/user-api/cancel"
    },
    "transactions": [{
        "item_list": {
            "items": [{
                "name": "Top balance",
                "sku": old_balance,
                "price": amount,
                "currency": "USD",
                "quantity": 1
            }]
        },
        "amount": {
            "currency": "USD",
            "total": amount
        },
        "description": cid
    }]
};

paypal.payment.create(create_payment_json, function (error, payment) {

    if (error) {
        throw error;
    } else {
        for (let i = 0; i < payment.links.length; i++) {
          if (payment.links[i].rel === 'approval_url') {
            res.redirect(payment.links[i].href);
          }
        }
    }
});
})


app.get('/user-api/paymentsuccess', async (req,res) => {
  const payerID = req.query.PayerID;
  const paymentId = req.query.paymentId;
 
  console.log(paypal.payment.get)
  var execute_payment_json = {
    "payer_id": payerID,
    // "transactions": [{
    //   "amount": {
    //     "currency": "USD",
    //     "amount": "10.00"
    //   }
    // }]
  }

  paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
    if (error) {
      console.log(error.response)
      throw error
    } else {
      console.log("Get Payment Response")
      // console.log(JSON.stringify(payment))
      // res.redirect("/user-api/paymentsuccess")
      // var jsonObj = JSON.parse(payment)
      // console.log(payment)
      var cid = payment.transactions[0].description
      var amount = parseFloat(payment.transactions[0].amount.total)
      var old_amount = parseFloat(payment.transactions[0].item_list.items[0].sku)
      console.log(old_amount)
      // console.log(parseInt(amount))
      // console.log(parseInt(old_amount))
      var new_balance = old_amount + amount

      // console.log(new_balance)

      var cardBalancequery = `update cards set balance = ${new_balance} where cid = '${cid}' `
        try {
          pool.query(cardBalancequery);
          topBalanceLog(cid, amount, new_balance, '-paypal-')
          res.render("pages/paymentsuccess.ejs", {amount:amount, cid:cid, new_balance: new_balance})
         } catch (error) {
          res.end(error);
      }
    }
  })
})

app.get('user-api/cancel', (req,res) => res.send('cancelled'))





//gives a user admin access type on admin's request
app.post("/make_admin", async (req, res) => {
  if (req.session.token && req.body.uid) {
    if (req.session.token.access == "admin") {
      var id = req.body.uid;
      var makeadminquery = `update users set access = 'admin' where uid = '${id}'`;
      const result = await pool.query(makeadminquery);
      id = req.session.token.uid;
      res.redirect(`/admin/${id}`);
    } else {
      res.redirect(`/`);
    }
  } else {
    res.redirect(`/`);
  }
});

app.post("/verify_email", async (req, res) => {
  var code = req.body.code;
  var id = req.session.token.uid;
  if (code == req.session.token.status) {
    var makeactivequery = `update users set status = 'active' where uid = '${id}'`;
    const result = await pool.query(makeactivequery);
    id = req.session.token.uid;
    req.session.token.verify_status = 1;
    req.session.token.status = "active";
    res.redirect(`/dashboard/${id}`);
  } else {
    req.session.token.verify_status = 0;
    res.redirect(`/dashboard/${id}`);
  }
});

app.post("/forgotpsw", async (req, res) => {
  var cred = req.body.uname;
  var verifyQuery = `select password,email from users where email = '${cred}' or username = '${cred}';`;
  const result = await pool.query(verifyQuery);
  if (result.rows.length == 0) {
    forgotPsw.state = 1;
    res.redirect("/forgotPsw");
  } else {
    forgotPsw.state = 2;
    const status = await verifyEmail(
      result.rows[0].email,
      result.rows[0].password
    );
    res.redirect("/forgotPsw");
  }
});

//deletes user on admin's request
app.post("/delete_user", async (req, res) => {
  if (req.session.token.access == "admin") {
    var id = req.body.uid;
    var deleteuserquery = `delete from users where uid = '${id}'`;
    const result = await pool.query(deleteuserquery);
    id = req.session.token.uid;
    res.redirect(`/admin/${id}`);
  } else {
    res.redirect(`/`);
  }
});

//checks the entered login credentials and redirects to specific landing page
app.post("/login", async (req, res) => {
  var un = req.body.uname;
  var pwd = req.body.password;

  var verifyQuery = `SELECT * FROM users WHERE username='${un}' AND password='${pwd}'`;
  var result = await pool.query(verifyQuery);
  if (req.body.type == testingCode) {
    res.json(result);
  }

  if (result.rows.length != 0) {
    var type = result.rows[0].access;
    var id = result.rows[0].uid;
    req.session.token = result.rows[0];
    invalid_login.loggedIn = true;

    if (type == "user") {
      res.redirect(`/dashboard/${id}`);
    } else if (type == "admin") {
      res.redirect(`/admin/${id}`);
    } else {
      res.redirect("/login");
    }
  } else {
    invalid_login.value = "1";
    res.redirect("/login");
  }
});

//renders the display page that shows user's properties to admin
app.get("/get_user/:id", async (req, res) => {
  var id = req.params.id;

  if (req.session.token || req.body.type == testingCode) {
    if (req.session.token.access == "admin" || req.body.type == testingCode) {
      var verifyQuery = `SELECT * FROM users WHERE uid = '${id}'`;
      var result = await pool.query(verifyQuery);
      if (result.rows[0].access == "admin") {
        res.redirect(`/admin/${req.session.token.uid}`);
      } else {
        var allcardsquery = `SELECT * FROM cards where owner = '${id}'`;
        var res_cards = await pool.query(allcardsquery);
        const data = {
          cards: res_cards.rows,
          info: req.session.token,
          user: result.rows[0],
          loggedIn: true,
        };
        res.render("pages/check_user", data);
      }
    } else {
      res.redirect(`/dashboard/${req.session.token.uid}`);
    }
  } else {
    res.redirect("/login");
  }
});

//renders regular user profile page
app.get("/dashboard/:id", async (req, res) => {
  req.session.token.incorrectpw = 2; // 2 means later when opening change password, no successful message displayed

  var id = req.params.id;
  if (req.session && req.session.token) {
    if (req.session.token.access == "user" && req.session.token.uid == id) {
      var allcardsquery = `SELECT * FROM cards where owner = '${id}'`;
      const result = await pool.query(allcardsquery);
      req.session.token.cards = result.rows;
      const data = {
        cards: result.rows,
        info: req.session.token,
        loggedIn: true,
      };

      res.render("pages/user_profile", data);
    } else {
      res.redirect("/");
    }
  } else {
    res.redirect("/login");
  }
});


function decodeLog(row, cid){
  var text;
  if(row.type == '-new-'){
    text = "This card has been assigned to your account";
  }
  else if(row.type == '-credit-'){
    text = `${row.transfer} dollars deposited (from credit card)`
  }
  else if(row.type == '-paypal-'){
    text = `${row.transfer} dollars deposited (with paypal)`
  }
  else if(row.type == '-transfer-'){
    if(cid == row.cid_prim)
    {
      text = `Internal withdraw of ${row.transfer} dollars `
    }
    else{
      text = `Internal deposit of ${row.transfer} dollars`
     }
  }
  else{
    text = `Card name changed to ${row.type}`
  }
  return text;
}


function getLogs(rows, cid){
  var result = []
  rows.reverse().forEach(function(r){
    const text = decodeLog(r, cid)
    const balance = (cid == r.cid_prim) ? r.prim_balance : r.sec_balance;
    const date = moment(r.date).format('dddd, DD MMMM')
    const time = moment(r.date).format('h:mm')
    console.log(date)
    console.log(time)
    var object = {
      date: date,
      time: time,
      text: text,
      balance: balance
    }
    result.push(object)
  })
  return result;

}

app.get("/card/:cid", async (req, res) => {
  if (req.session.token && req.session.token.access == "user") {
    var cid = req.params.cid;
    var real_owner = false;
    var card;
    req.session.token.cards.forEach(function(r) {
      if (r.cid == cid) {
        real_owner = true;
        card = r;
      }
    });
    // console.log(real_owner, card, req.params)
    if (real_owner) {
      var cardLogQuery = `SELECT * FROM card_log where cid_prim = '${cid}' or cid_sec = '${cid}' `;
      const result = await pool.query(cardLogQuery);
      const logs = getLogs(result.rows, cid);
      //console.log(result.rows);
      const data = { r: card, logs: logs, info: req.session.token, loggedIn: true };
      res.render("pages/card_manage", data);
    }
  }
});


//renders admin profile page
app.get("/admin/:id", async (req, res) => {
  if (req.session.token) {
    req.session.token.incorrectpw = 2; // 2 means later when opening change password, no successful message displayed
    var id = req.params.id;
    if (req.session.token.access == "admin" && req.session.token.uid == id) {
      var allusersquery = `SELECT * FROM users order by uid`;
      const result1 = await pool.query(allusersquery);
      var allReqQuery = `SELECT * FROM verRequest order by uid`;
      const result2 = await pool.query(allReqQuery);
      const data = {
        users: result1.rows,
        requests : result2.rows,
        info: req.session.token,
        loggedIn: true,
      };
      res.render("pages/admin_profile", data);
    } else {
      res.redirect("/login");
    }
  } else {
    res.redirect("/login");
  }
});

// change password, same interface for both user and admin
app.get("/changepw/:id", async (req, res) => {
  var id = req.params.id;
  // check if this is testing to bypass session, still does same thing
  if (req.body.type == testingCode) {
    // console.log()
    var verifyQuery = `SELECT * FROM users WHERE username='${req.body.username}' AND password='${req.body.password}'`;
    var result = await pool.query(verifyQuery);
    const data = { info: result.rows[0], loggedIn: true };
    res.render("pages/change_pw", data);
    return;
  }
  if (req.session.token) {
    if (req.session.token.uid == id) {
      const data = { info: req.session.token, loggedIn: true };
      res.render("pages/change_pw", data);
    } else {
      res.redirect("/");
    }
  } else {
    res.redirect("/login", { loggedIn: false });
  }
});

app.post("/user-api/changepw/:id", async (req, res) => {
  var uid = req.params.id;
  var un = req.body.uname;
  var oldPassword = req.body.old_password;
  var newPassword = req.body.new_password;

  var verifyQuery = `SELECT * FROM users WHERE username='${un}' AND password='${oldPassword}'`;
  var result = await pool.query(verifyQuery);

  // testing code


  if (result.rows && result.rows.length != 0) {
    if (oldPassword == newPassword) {
      if (!req.session.token) {
        // testing code
        result.message = "Password is not changed";
        res.json(result);
        return;
      }
      req.session.token.incorrectpw = 3; // 3 means old is same as new
    } else {
      var changepasswordQuery = `UPDATE users SET password='${newPassword}' WHERE uid='${uid}'`;
      var changePasswordResult = await pool.query(changepasswordQuery);
      var type = result.rows[0].access;

      req.session.token.incorrectpw = 0; // 0 means password is sucessfuly changed
    }
  } else {
    req.session.token.incorrectpw = 1; // 1 means old password is not found
  }
  // for first time opening to changepw, incorrectpw is set to 2 (won't display anything)
  res.redirect(`/changepw/${uid}`);
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    req.session = null;
    res.redirect("/login"); // will always fire after session is destroyed
  });
});

//direct the page to about us
app.get("/aboutus", (req, res) => {
  if (req.session.token) {
    res.render("pages/aboutus", { loggedIn: true, info: req.session.token });
  } else {
    res.render("pages/aboutus", { loggedIn: false });
  }
});

//direct the page to caress
app.get("/careers", (req, res) => {
  if (req.session.token) {
    res.render("pages/careers", { loggedIn: true, info: req.session.token });
  } else {
    res.render("pages/careers", { loggedIn: false });
  }
});

//direct the page to privacy_policy
app.get("/privacypolicy", (req, res) => {
  if (req.session.token) {
    res.render("pages/privacypolicy", {
      loggedIn: true,
      info: req.session.token,
    });
  } else {
    res.render("pages/privacypolicy", { loggedIn: false });
  }
});

//direct the page to forum
app.get("/forum", (req, res) => {
  if (req.session.token) {
    res.render("pages/forum", { loggedIn: true, info: req.session.token });
  } else {
    res.render("pages/forum", { loggedIn: false });
  }
});

//direct the page to contact_us
app.get("/contactus", (req, res) => {
  if (req.session.token) {
    res.render("pages/contactus", { loggedIn: true, info: req.session.token });
  } else {
    res.render("pages/contactus", { loggedIn: false });
  }
});

app.get("/ponyo", async (req, res) => {

  let selectReviewsQuery = "SELECT MAX(counter) FROM user_reviews_ride"
  let result = await pool.query(selectReviewsQuery);
  res.json(result.rows);
})

app.get("*", (req, res) => {
  // redirects to error page when some garbage url entered
  if (req.session.token) {
    const data = { info: req.session.token, loggedIn: true };
    res.render("pages/error", data);
  } else res.render("pages/error", { loggedIn: false });
});

module.exports = app;
