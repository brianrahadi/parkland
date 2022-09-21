require("dotenv").config();

var chai = require("chai");
var chaiHttp = require("chai-http");
var server = require("../index");
var should = chai.should();
const expect = require("chai").expect;
const session = require("express-session");
let mockSession = require('mock-session');
let cookie = mockSession('session', 'zordon', {"count":1});  

// require("dotenv").config()
server.use(
  session({
    name: "session",
    secret: "zordon",
    resave: false,
    saveUninitialized: false,
    maxAge: 30 * 60 * 1000, // 30 minutes
  })
);
let testingCode = process.env.TEST;

chai.use(chaiHttp);
function randomString(length) {
  let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  let str = "";
  for (let i = 0; i < length; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return str;
}
let testedUsername = "bobby";
let testedPassword = "12344321";

let userId = 78;
let userUsername = "dannyliuregularuser";
let userPassword = "regularuser";

let randUsername = randomString(10);
let randPassword = randomString(10);

describe("USER Login testing", function() {
  it("TEST get /login", async () => {
    var res = await chai.request(server).get("/login");
    res.should.have.status(200);
  });

  it("TEST post successful user /login", async () => {
    var res = await chai
      .request(server)
      .post("/login")
      .send({ uname: userUsername, password: userPassword , type: testingCode});
    res.should.have.status(200);
    res.body.rows.length.should.equal(1);
  });
})

describe("ADMIN Login testing", function() {
  it("TEST get /login", async () => {
    var res = await chai.request(server).get("/login");
    res.should.have.status(200);
  });

  it("TEST post successful /login", async () => {
    var res = await chai
      .request(server)
      .post("/login")
      .send({ uname: testedUsername, password: testedPassword });
    res.should.have.status(200);
    res.redirects.should.be.a("array");
    res.redirects.length.should.equal(2);
    // length of 2 where 1 is for the login page and the other one is the new one which is redirected to admin page
  });

  it("TEST post unsuccessful /login", async () => {
    var res = await chai
      .request(server)
      .post("/login")
      .send({ uname: testedUsername, password: "thisisinvalidpassword" });
    res.should.have.status(200);
    res.redirects.should.be.a("array");
    res.redirects.length.should.equal(1);
    // only one which means unsuccessful login (still at login page);
  });
});

describe("Successful GET testing", function() {
  it("TEST get /weather", async () => {
    var res = await chai.request(server).get("/weather");
    res.should.have.status(200);
    Number(res.header["content-length"]).should.be.above(2300);
  });

  it("TEST get /aboutus", async () => {
    var res = await chai.request(server).get("/aboutus");
    res.should.have.status(200);
    Number(res.header["content-length"]).should.be.above(1800);
    // testing if rendered html content is quite filled (not make it as specific to make sure test still work if html is changed)
  });

  it("TEST get /careers", async () => {
    var res = await chai.request(server).get("/careers");
    res.should.have.status(200);
    Number(res.header["content-length"]).should.be.above(1800);
    // testing if rendered html content is quite filled (not make it as specific to make sure test still work if html is changed)
  });

  it("TEST get /privacypolicy", async () => {
    var res = await chai.request(server).get("/privacypolicy");
    res.should.have.status(200);
    Number(res.header["content-length"]).should.be.above(1800);
  });

  it("TEST get /forum", async () => {
    var res = await chai.request(server).get("/forum");
    res.should.have.status(200);
    Number(res.header["content-length"]).should.be.above(1800);
  });


  it("TEST (home) get /", async () => {
    var res = await chai.request(server).get("/");
    res.should.have.status(200);
    Number(res.header["content-length"]).should.be.above(4000);
  });

  it("TEST get /forgotPsw", async () => {
    var res = await chai.request(server).get("/forgotPsw");
    res.should.have.status(200);
    Number(res.header["content-length"]).should.be.above(4000);
  });
});

describe("Unsuccessful GET Testing", function() {
  it("TEST get /x", async () => {
    var res = await chai.request(server).get("/x");
    Number(res.text.length).should.be.below(2000);
    // unsuccessful get will only render the header, footer, and an empty white body saying "Sorry this page doesn't exist"
  });

});

describe("Sign-up testing", function() {
  it("TEST unsuccessful signup POST /user-api/adduser", async () => {
    // testing signup with a taken username
    var res = await chai
      .request(server)
      .post("/user-api/adduser")
      .send({ uname: testedUsername, password: testedPassword });
    res.should.have.status(200);
    expect(res.req.path).to.equal("/adduser"); // this means sign in is failed. Because if success -> path to /login

  });
});

describe("Functional test -> login as admin, update all info, and get user test", function() {
  it("TEST login as admin", async () => {
    var res1 = await chai
      .request(server)
      .post("/login")
      .send({ uname: testedUsername, password: testedPassword });
    res1.should.have.status(200);
  });

  it("TEST update info as admin", async () => {
    let randEmail = "brianwgraal@gmail.com";
    const now = new Date();
    let randFirstName = now.getHours() + ":" + now.getMinutes(); // first name of bobby to current time
    let randLastName = randomString(5);
    var res2 = await chai
      .request(server)
      .post("/user-api/updateuser/2")
      .send({
        email: randEmail,
        f_name: randFirstName,
        l_name: randLastName,
        offer: "on",
      });
    res2.should.have.status(200);
    res2.redirects.length.should.equal(2);


  })

  it ("TEST get user info as admin", async () => {
    var res3 = await chai.request(server).get("/get_user/78");
    res3.should.have.status(200);
    res3.redirects.length.should.equal(1);

  })
});

describe("User Logout", function() {
  it("Test logout", async () => {
    var res = await chai.request(server).get("/logout")
    res.should.have.status(200);
  })
})

describe("Change Password", function() {
  it("TEST post successful user /login", async () => {
    var res = await chai
      .request(server)
      .post("/login")
      .send({ uname: userUsername, password: userPassword , type: testingCode});
    res.should.have.status(200);
    res.body.rows.length.should.equal(1);
  });
  
  it("Test get /changepw", async () => {
    var res = await chai.request(server).get("/changepw/78").send({type: testingCode, username: userUsername, password: userPassword})
    res.should.have.status(200);
    Number(res.header["content-length"]).should.be.above(2200);
    expect(res.req.path).to.equal("/changepw/78");
  })

  // this will not produce any error in the website because this is in testing.
  it ("TEST unsuccessful post /changepw", async () => {
    var res = await chai.request(server).post("/user-api/changepw/78").send({type: testingCode, uname: userUsername, old_password: userPassword, new_password: userPassword})
    res.should.have.status(200);
    res.body.message.should.equal("Password is not changed")
  })


  // NO testing of successfull post /changepw because this type of testing cannot be repeated. New password will never be the same as old password.
})

describe("TEST /addcreditcard ", function() {
  it("TEST get /addcreditcard while logged out", async () => {
    var res = await chai.request(server).get("/addcreditcard").send({uid: userId})
    res.should.have.status(200);
    Number(res.header["content-length"]).should.be.above(6000);
    // Number(res.header["content-length"]).should.be.above(20000);
  });
})


describe("TEST all about cards ", function() {
  let latestCid;
  it("TEST post /user-api/addcard", async () => {
    var res = await chai.request(server).post("/user-api/addcard").send({type: testingCode, uid: userId});
    res.should.have.status(200);
    latestCid = res.body.rows[0].cid;
  });


  it("TEST post /card/name_change", async () => {
    var res = await chai.request(server).post("/card/name_change").send({type: testingCode, cid: userId, new_name: "Test_new_card"});
    res.should.have.status(200);
    res.body.message.should.equal("Card successfully updated")
  });

  it("TEST post /user-api/deletecard", async () => {
    var res = await chai.request(server).post("/user-api/deletecard").send({type: testingCode, cid: latestCid, uid: userId});
    res.should.have.status(200);
    res.body.message.should.equal("Card successfully deleted")
  });
  
})


describe("TEST GET and POST for rides and ADD/UPDATE/DELETE rides' reviews", function() {

    it("TEST GET /rides", async () => {
      var res = await chai.request(server).get("/rides");
      res.should.have.status(200);
      res.req.path.should.equal("/rides");

    });

    it("TEST GET /rides/:id", async () => {
      var res = await chai.request(server).get("/rides/1");
      res.should.have.status(200);
      res.req.path.should.equal("/rides/1");
    });

    it("TEST GET /rides/:id/addreview NOT LOGGED IN", async () => {
      var res = await chai.request(server).get("/rides/1/addreview");
      res.should.have.status(200);
      res.req.path.should.equal("/rides/1"); // because not logged in, will be redirected to the rides page itself
    });

    it("TEST GET /rides/:id/addreview LOGGED IN", async () => {
      var res = await chai.request(server).get("/rides/1/addreview").send({ type: testingCode });
      res.should.have.status(200);
      res.body.rideid.should.equal(1);
      res.body.ridename.should.equal("Ferris Wheel");
      res.req.path.should.equal("/rides/1/addreview");
    });

    it("TEST POST /rides/:id/addreview NOT LOGGED IN", async () => {
      var res = await chai.request(server).post("/rides/2/addreview").send({ type: testingCode, rating: 5, comment: "This is a comment ran in npm test from someone that has not logged in"});
      res.should.have.status(200);
      res.body.message.should.equal('Failure to add review. User not logged in!');
    });

    let counterOfToBeDeletedReview = 34;
    it("TEST POST /rides/:id/addreview LOGGED IN", async () => {
      var res = await chai.request(server).post("/rides/2/addreview").send({ type: testingCode, uid: userId, username: userUsername, password: userPassword, rating: 5, comment: "This is a comment ran in npm test from someone that has logged in"});
      res.should.have.status(200);
      res.body.rowCount.should.equal(1);
      counterOfToBeDeletedReview = res.body.rows[0].counter;
      res.body.rows[0].comment.should.equal('This is a comment ran in npm test from someone that has logged in');
      res.body.rows[0].rating.should.equal(5);

    });
     it("TEST get /rides/:rideid/updatereview/:counter NOT LOGGED IN", async () => {
      var res = await chai.request(server).get(`/rides/2/updatereview/${counterOfToBeDeletedReview}`);
      res.should.have.status(200);
      res.req.path.should.equal("/rides/2") // redirected because user is not logged in
    })

    it("TEST get /rides/:rideid/updatereview/:counter LOGGED IN AND WITH ACCESS", async () => {
      var res = await chai.request(server).get(`/rides/2/updatereview/${counterOfToBeDeletedReview}`).send({ type: testingCode, uid: userId, username: userUsername, password: userPassword });
      res.should.have.status(200);
      res.req.path.should.equal(`/rides/2/updatereview/${counterOfToBeDeletedReview}`);
      res.body.review.counter.should.equal(counterOfToBeDeletedReview);
      res.body.review.comment.should.equal('This is a comment ran in npm test from someone that has logged in');
      res.body.ride.rideid.should.equal(2);
      res.body.ride.ridename.should.equal('Boogie Cars');
    })

    it("TEST POST /rides/:rideid/updatereview/:counter NOT LOGGED IN", async () => {
      var res = await chai.request(server).post(`/rides/2/updatereview/${counterOfToBeDeletedReview}`).send({ type: testingCode });
      res.should.have.status(200);
      res.body.message.should.equal("Failure to update review. User not logged in!")
    })

    it("TEST POST /rides/:rideid/updatereview/:counter LOGGED IN BUT WITHOUT ACCESS", async () => {
      var res = await chai.request(server).post(`/rides/2/updatereview/${counterOfToBeDeletedReview}`).send({ type: testingCode, uid: userId, username: userUsername, password: "invalidpw", rating: 4, comment: "This is an updated comment ran in npm test from someone that has logged in" });
      res.should.have.status(200);
      res.body.message.should.equal("Failure to update review. User logged in but does not have access!")
    })

    it("TEST POST /rides/:rideid/updatereview/:counter LOGGED IN AND WITH ACCESS", async () => {
      var res = await chai.request(server).post(`/rides/2/updatereview/${counterOfToBeDeletedReview}`).send({ type: testingCode, uid: userId, username: userUsername, password: userPassword, rating: 4, comment: "This is an updated comment ran in npm test from someone that has logged in" });
      res.body.rows[0].comment.should.equal('This is an updated comment ran in npm test from someone that has logged in');
      res.body.rows[0].rating.should.equal(4);
      res.should.have.status(200);
    })

    it("TEST POST /rides/:rideid/deletereview/:counter NOT LOGGED IN", async () => {
      var res = await chai.request(server).post(`/rides/2/deletereview/${counterOfToBeDeletedReview}`).send({ type: testingCode });
      res.should.have.status(200);
      res.body.message.should.equal("Failure to delete review. User not logged in!")
    })

    it("TEST POST /rides/:rideid/deletereview/:counter LOGGED IN BUT WITHOUT ACCESS", async () => {
      var res = await chai.request(server).post(`/rides/2/deletereview/${counterOfToBeDeletedReview}`).send({ type: testingCode, uid: userId, username: userUsername, password: "invalidpw"});
      res.should.have.status(200);
      res.body.message.should.equal("Failure to delete review. User logged in but does not have access!")
      
    })    

    it("TEST POST /rides/:rideid/deletereview/:counter LOGGED IN AND WITH ACCESS", async () => {
      var res = await chai.request(server).post(`/rides/2/deletereview/${counterOfToBeDeletedReview}`).send({ type: testingCode, uid: userId, username: userUsername, password: userPassword});
      res.should.have.status(200);
      res.body.message.should.equal("Review successfully deleted!")
      
    })
})