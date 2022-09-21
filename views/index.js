require('dotenv').config();
var nodemailer = require('nodemailer');
var validator = require("email-validator");
const emailValidator = require('deep-email-validator');
const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const session = require('express-session')

const { Pool } = require('pg');
const { waitForDebugger } = require('inspector');
var pool;
pool = new Pool({
  connectionString: process.env.DATABASE_URL_1
  
})


async function isEmailValid(email) {
  result = emailValidator.validate(email)
  console.log(result);
  return result
}

function randomString (length ) {
    
  let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  let str = '';
  for (let i = 0; i < length; i++) {
      str += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return str;
};


invalid_login = {value: "0", loggedIn: false}
invalid_username = {taken: 0}

var app = express()
app.use(express.json())
app.use(session({
  name: 'session',
  secret: 'zordon',
  resave: false,
  saveUninitialized: false,
  maxAge: 30 * 60 * 1000  // 30 minutes
}))


app.use(express.urlencoded({extended:false}))
app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

// start of Danny's code for Weather API
app.get('/weather', (req, res) => {
	var request = require('request');
	request(
		`https://api.openweathermap.org/data/2.5/weather?q=vancouver&appid=b9b53f4273f041970a7bbc79b250ccaf`,
		function(error, response, body) {
			let data = JSON.parse(body);
			if (response.statusCode === 200) {
				// res.send(`Current Weather at the Park: ${JSON.stringify(data)}`);
        current = data.weather
        // current = weather.description
        weather = current[0].description.toString()
        console.log(data)
        temp = data.main.temp
        feels_like = data.main.feels_like
        humidity = data.main.humidity
        visibility = data.visibility
        wind = data.wind.speed
        res.render('pages/weather', {weather:weather, temp:temp, feels_like:feels_like, visibility:visibility, humidity:humidity, wind:wind})
			}
		}
	);
});
// end of Danny's code


app.listen(PORT, () => console.log(`Listening on ${ PORT }`))


var transporter = nodemailer.createTransport({

  host: "smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "b2218052eb59d8",
    pass: "1ace478e3d83da"
  }
});

async function verifyEmail(recip){
  const str = randomString(15, 20)
  var mailOptions = {
    from: 'b2218052eb59d8',
    to: recip,
    subject: 'Verification email',
    text: 'Please verify your email address. Use this token as a code: ' + str
  };
  
  const {valid, reason, validators} = await isEmailValid(email);
  console.log(valid, reason)
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
  return str
}

//renders home page
app.get('/', (req, res) => {
  if (req && req.session && req.session.token) {
    res.render('pages/index', {loggedIn: true, info: req.session.token})
  } else {
    res.render('pages/index', {loggedIn: false})
  }
})

//renders login page
app.get('/login', (req, res) => {
  res.render('pages/singin', invalid_login)
})

//renders sign up page
app.get('/adduser', (req, res) => {
  
  res.render('pages/adduser', invalid_username)
  invalid_username.taken = 0;
})

//signs up a new user 
app.post('/user-api/adduser',async(req,res)=>{
  var usern = req.body.uname
  var email = req.body.email
  var pw = req.body.password
  var offer = req.body.offer
  var f_name = req.body.f_name
  var l_name = req.body.l_name
  
  const str = await verifyEmail(email);
  
  if(offer == 'on') {
    offer = 1
  } else {
    offer=0;
  }
  // put person in the database
  console.log(offer)
  var userinsertquery = `INSERT INTO users (f_name, l_name, username, email, password, access, get_prom, kids) VALUES ('${f_name}','${l_name}','${usern}', '${email}', '${pw}', 'user', '${offer}', '0');`
  try{
      const result = await pool.query(userinsertquery)
      var ret_obj = {username: usern, password: pw}
      res.redirect('/login')
  }
  catch (error) {
    invalid_username.taken = 1;
    res.redirect('/adduser')
  }
})

//updates user's info
app.post('/user-api/updateuser/:id', async (req, res) => {
  var email = req.body.email
  var f_name = req.body.f_name
  var l_name = req.body.l_name
  var offer = req.body.offer;
  if(offer == 'on') {
    offer = 1
  } else {
    offer = 0;
  }
  var userupdatequery = `UPDATE users SET email='${email}', f_name='${f_name}', l_name='${l_name}', get_prom='${offer}' WHERE uid=${req.params.id}`;
  
  try{
    const result = await pool.query(userupdatequery)
    req.session.token.email = email;
    req.session.token.f_name = f_name;
    req.session.token.l_name = l_name;
    req.session.token.get_prom = offer;
    let pathLink = req.body.access == 'user' ? 'dashboard' : 'admin';
    res.redirect(`/${pathLink}/${req.params.id}`)
  }
  catch (error) {
      console.log(error)
  }
})

//adds payment card on user's request
app.post('/user-api/addcard', async(req,res)=>{  
  console.log("Hello1")
  var id = req.body.uid
  var userinsertquery = `INSERT INTO cards (owner, cname, balance, spent_amount) VALUES ('${id}', 'My_Card', '0', '0')`
  try{
      const result = await pool.query(userinsertquery)
      console.log("Hello1")
      console.log(result)
      res.redirect(`/dashboard/${id}`)
  }
  catch (error) {
      res.end(error)
  }
})

//deletes payment card on user's request
app.post('/user-api/deletecard', async(req,res)=>{  
  var cid = req.body.cid
  var uid = req.body.uid
  console.log(cid, uid)
  var userinsertquery = `delete from cards where cid = '${cid}' `
  try{
      const result = await pool.query(userinsertquery)
      res.redirect(`/dashboard/${uid}`)
  }
  catch (error) {
      res.end(error)
  }
})


//gives a user admin access type on admin's request
app.post('/make_admin', async(req,res)=>{
  if (req.session.token && req.body.uid)
  {
    if(req.session.token.access == 'admin')
    {  
      var id = req.body.uid
      var makeadminquery = `update users set access = 'admin' where uid = '${id}'`; 
      const result = await pool.query(makeadminquery)
      id = req.session.token.uid
      res.redirect(`/admin/${id}`)
    }
    else{res.redirect(`/`)}
  }
  else{res.redirect(`/`)}
})



//deletes user on admin's request
app.post('/delete_user', async(req,res)=>{
  
    if(req.session.token.access == 'admin')
    {  
      var id = req.body.uid
      var deleteuserquery = `delete from users where uid = '${id}'`; 
      const result = await pool.query(deleteuserquery)
      id = req.session.token.uid
      res.redirect(`/admin/${id}`)
    }
    else{res.redirect(`/`)}

})

//checks the entered login credentials and redirects to specific landing page
app.post('/login', async (req,res)=> {
  var un = req.body.uname
  var pwd = req.body.password

  var verifyQuery = `SELECT * FROM users WHERE username='${un}' AND password='${pwd}'`
  var result = await pool.query(verifyQuery)
  
  if (result.rows.length != 0 )
  { 
    var type = result.rows[0].access
    var id = result.rows[0].uid
    req.session.token = result.rows[0]
    invalid_login.loggedIn = true;

    if (type == 'user'){
      res.redirect(`/dashboard/${id}`)
    }
    else if(type == 'admin'){
      res.redirect(`/admin/${id}`)
    } 
    else {
      res.redirect('/login')
    }
  }
  else{
      invalid_login.value = '1';
      res.redirect('/login')
  }
})

//renders the display page that shows user's properties to admin 
app.get('/get_user/:id', async (req,res)=>{
  var id = req.params.id
  if (req.session.token)
  {
    if(req.session.token.access == 'admin')
    {
      var verifyQuery = `SELECT * FROM users WHERE uid = '${id}'`
      var result = await pool.query(verifyQuery)
      if(result.rows[0].access == 'admin'){res.redirect(`/admin/${req.session.token.uid}`)}
      else{
      var allcardsquery = `SELECT * FROM cards where owner = '${id}'`;
      var res_cards = await pool.query(allcardsquery)
      const data = { cards: res_cards.rows, info: req.session.token, user: result.rows[0], loggedIn: true}
      res.render('pages/check_user', data)}
    }
    else{
      res.redirect(`/dashboard/${req.session.token.uid}`)
    }
  }
  else{
    res.redirect('/login')
  }
})

//renders regular user profile page
app.get('/dashboard/:id', async (req,res)=>{
  req.session.token.incorrectpw = 2; // 2 means later when opening change password, no successful message displayed

  var id = req.params.id
  if (req.session.token)
  {
    if(req.session.token.access == 'user' && req.session.token.uid == id )
    {
      var allcardsquery = `SELECT * FROM cards where owner = '${id}'`;
      const result = await pool.query(allcardsquery)
      const data = { cards: result.rows , info: req.session.token, loggedIn: true}

      res.render('pages/user_profile', data)
    }
    else{res.redirect('/')}
  }
  else{
    res.redirect('/login')
  }
})

//renders admin profile page
app.get('/admin/:id', async (req,res)=>{
  
  if (req.session.token)
  {
    req.session.token.incorrectpw = 2; // 2 means later when opening change password, no successful message displayed
    var id = req.params.id
    if(req.session.token.access == 'admin' && req.session.token.uid == id)
    {
      var allusersquery = `SELECT * FROM users order by uid`;
      const result = await pool.query(allusersquery)
      const data = {users: result.rows, info: req.session.token, loggedIn: true}
      res.render('pages/admin_profile', data)
    }
    else{
      res.redirect('/login')
    }
  }
  else{
    res.redirect('/login')
  }
})

// change password, same interface for both user and admin
app.get('/changepw/:id', async (req, res) => {
  var id = req.params.id
  if (req.session.token)
  {
    if(req.session.token.uid == id )
    {
      const data = {info: req.session.token, loggedIn: true}
      res.render('pages/change_pw', data)    
    }
    else{
      res.redirect('/')
    }
  }
  else{
    res.redirect('/login', {loggedIn: false})
  }
})

app.post('/user-api/changepw/:id', async (req, res) => {
  var uid = req.params.id;
  var un = req.body.uname;
  var oldPassword = req.body.old_password;
  var newPassword = req.body.new_password;
  
  var verifyQuery = `SELECT * FROM users WHERE username='${un}' AND password='${oldPassword}'`
  var result = await pool.query(verifyQuery)
  if (result.rows && result.rows.length != 0 )
  { 
    if (oldPassword == newPassword) {
      req.session.token.incorrectpw = 3; // 3 means old is same as new
    } else {
      var changepasswordQuery = `UPDATE users SET password='${newPassword}' WHERE uid='${uid}'`
      var changePasswordResult = await pool.query(changepasswordQuery);
      var type = result.rows[0].access;
  
      req.session.token.incorrectpw = 0; // 0 means password is sucessfuly changed
    }

  }
  else{
    req.session.token.incorrectpw = 1; // 1 means old password is not found
  }
  // for first time opening to changepw, incorrectpw is set to 2 (won't display anything)
  res.redirect(`/changepw/${uid}`)

  
})

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    req.session = null;
    res.redirect('/login') // will always fire after session is destroyed
  })

})
app.get('*', (req, res) => { // redirects to error page when some garbage url entered
  if (req.session.token)
  {
    const data = {info: req.session.token, loggedIn: true}
    res.render('pages/error', data)
  }
    
  else
    res.render('pages/error', {loggedIn: false} )
})

