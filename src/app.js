const Sequelize = require('sequelize')
const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const app = express()
const bcrypt = require ('bcrypt')
const sequelize = new Sequelize({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTRES_PASSWORD,
  database: process.env.BLOGAPP,
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  dialect: 'postgres',
  storage: './session.postgres',
  define: {
    timestamps: false
  }
});

app.use(express.static('public'))
app.set('views', './views')
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(session({
  store: new SequelizeStore({
    db: sequelize,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 24 * 60 * 60 * 1000
  }),
  secret: "safe",
  saveUnitialized: true,
  resave: false
}))

const User = sequelize.define('users', {
  username: {
    type: Sequelize.STRING,
    unique: true
  },
  email: {
    type: Sequelize.STRING,
    unique: true
  },
  password: {
    type: Sequelize.STRING
  }
});

const Post = sequelize.define('posts', {
  title: {
    type: Sequelize.STRING
  },
  content: {
    type: Sequelize.STRING
  }
});

const Comment = sequelize.define('comments', {
  reply: {
    type: Sequelize.STRING
  }
});

User.hasMany(Post)
Post.belongsTo(User)
Post.hasMany(Comment)
Comment.belongsTo(Post)
User.hasMany(Comment)
Comment.belongsTo(User)

//REGISTER
app.get('/register', (req, res) => {
  res.render('register');
})
app.post('/register', (req, res) => {
  bcrypt.hash(req.body.password, 9).then( hash =>{
  User.create({
    username: req.body.username,
    email: req.body.email,
    password: hash
  }).then(() => {
    res.redirect('/')
  })
})
});

//LOG IN
app.get('/', (req, res) => {
  res.render("login")
})
app.post('/', (req, res) => {
  var email = req.body.email;
  var password = req.body.password;
  User.findOne({
      where: {
        email: email
      }
    }).then((user) => {
    bcrypt.compare(password , user.password)
    .then(function(result){
      if (user !== null && result) {
        req.session.user = user
        res.redirect('/posts');
      } else {
        res.render("register")
      }
    })
    .catch(function(error) {
      console.log("error" + error)    })
  })
});

//ALLPOSTS
app.get('/posts', (req, res) => {
     const user = req.session.user;

  Post.findAll({
      include: [{
        model: User
      }]
    })
    .then((post) => {
console.log(req.session.user)
      res.render('allposts', {
        user: user,
        post: post
      })
    });
});

//NEWPOST
app.get('/posts/new', (req, res) => {
  let user = req.session.user;
  if (user === undefined) {
    res.redirect('/')
  } else {
    res.render("newpost", {
      user: user
    });
  }
});
app.post('/posts/new', (req, res) => {
  var user = req.session.user.username;
  var title = req.body.title;
  var content = req.body.content;
  User.findOne({
      where: {
        username: user
      }
    })
    .then(function(user) {
      return user.createPost({
        title: title,
        content: content
      })
    })
    .then(post => {
      var user = req.session.user.username;
      res.redirect(`/posts/${post.id}`);
    })
});

//USERPOSTS
app.get('/posts/user/:username', (req, res) => {
  const username = req.params.username;
  User.findOne({
      where: {
        username: username
      },
      include: [{
        model: Post
      }, {
        model: Comment
      }]
    })
    .then(function(user) {
      res.render("userposts", {
        user: user,
        post: user.posts
      })
    })
})

//SPECIFICPOST
app.get('/posts/:id', function(req, res) {
  const postId = req.params.id
  // let posts;
  let promise1 = Post.findOne({
    where: {
      id: postId
    },
    include: [{
      model: User
    }]
  })
  let promise2 = (Comment.findAll({
    where: {
      postId: postId
    },
    include: [{
      model: User
    }]
  }))
  Promise.all([promise1, promise2])
    .then(function(all) {
      let post = all[0];
      let comment = all[1]
      res.render("specificpost", {
        post: post,
        comment: comment
      })
    })
})
app.post('/posts/:id', function(req, res) {
  const post = req.params.id
  const user = req.session.user.id
  Comment.create({
      reply: req.body.comment,
      postId: post,
      userId: user
    })
    .then((information) => {
      res.redirect(`/posts/${post}`)
    })
})

//LOGOUT
app.get('/logout', (req, res) => {
  req.session.destroy(function(error) {
    if (error) {
      throw error
    }
    res.redirect('/')
  })
});

sequelize.sync({force:false})
const server = app.listen(2564, function() {
  console.log("port: " + server.address().port)
})
