// We import modules.
const url = require("url");
const path = require("path");
const express = require("express");
const passport = require("passport");
const session = require("express-session");
const Strategy = require("passport-discord").Strategy;
const config = require("../config");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const Discord = require("discord.js");
const GuildSettings = require("../models/settings");

// We instantiate express app and the session store.
const app = express();
const MemoryStore = require("memorystore")(session);
const db = require("quick.db");
// We export the dashboard as a function which we call in ready event.
module.exports = async (client) => {
  // We declare absolute paths.
  const dataDir = path.resolve(`${process.cwd()}${path.sep}dashboard`); // The absolute path of current this directory.
  const templateDir = path.resolve(`${dataDir}${path.sep}templates`); // Absolute path of ./templates directory.

  // Deserializing and serializing users without any additional logic.
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  // Validating the url by creating a new instance of an Url then assign an object with the host and protocol properties.
  // If a custom domain is used, we take the protocol, then the hostname and then we add the callback route.
  // Ex: Config key: https://localhost/ will have - hostname: localhost, protocol: http
  
  var callbackUrl;
  var domain;
  
  try {
    const domainUrl = new URL(config.domain);
    domain = {
      host: domainUrl.hostname,
      protocol: domainUrl.protocol
    };
    console.log(domain)
  } catch (e) {
    console.log(e);
    throw new TypeError("Invalid domain specific in the config file.");
  }
  
  if (config.usingCustomDomain) {
    callbackUrl =  `${domain.protocol}//${domain.host}/callback`
  } else {
    callbackUrl = `${domain.protocol}//${domain.host}${config.port == 80 ? "" : `:${config.port}`}/callback`;
  }
  
  // This line is to inform users where the system will begin redirecting the users.
  // And can be removed.
  console.log("===");
  console.log(`Info: Make sure you have added the following url to the discord's OAuth callback url section in the developer portal:\n${callbackUrl}`);
  console.log("===");

  // We set the passport to use a new discord strategy, we pass in client id, secret, callback url and the scopes.
  /** Scopes:
   *  - Identify: Avatar's url, username and discriminator.
   *  - Guilds: A list of partial guilds.
  */
  passport.use(new Strategy({
    clientID: config.id,
    clientSecret: config.clientSecret,
    callbackURL: callbackUrl,
    scope: ["identify", "guilds", "guilds.join"]
  },

  (accessToken, refreshToken, profile, done) => { // eslint-disable-line no-unused-vars
    // On login we pass in profile with no logic.
    process.nextTick(() => {
       profile.tokens = { accessToken };
      done(null, profile)
      });
  }));

  // We initialize the memorystore middleware with our express app.
  app.use(session({
    store: new MemoryStore({ checkPeriod: 86400000 }),
    secret: "#@%#&^$^$%@$^$&%#$%@#$%$^%&$%^#$%@#$%#E%#%@$FEErfgr3g#%GT%536c53cc6%5%tv%4y4hrgrggrgrgf4n",
    resave: false,
    saveUninitialized: false,
  }));

  // We initialize passport middleware.
  app.use(passport.initialize());
  app.use(passport.session());

  // We bind the domain.
  app.locals.domain = config.domain.split("//")[1];

  // We set out templating engine.
  app.engine("html", ejs.renderFile);
  app.set("view engine", "html");

  // We initialize body-parser middleware to be able to read forms.
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({
    extended: true
  }));

  
  // We host all of the files in the assets using their name in the root address.
  // A style.css file will be located at http://<your url>/style.css
  // You can link it in any template using src="/assets/filename.extension"
  app.use("/", express.static(path.resolve(`${dataDir}${path.sep}assets`)));
  
  // We declare a renderTemplate function to make rendering of a template in a route as easy as possible.
  const renderTemplate = (res, req, template, data = {}) => {
    // Default base data which passed to the ejs template by default.
      let clientDetail = {
     guilds: client.guilds.cache.size,
     users: client.users.cache.size,
     channels: client.channels.cache.size
   }; 

    const baseData = {
      bot: client,
      path: req.path,
      user: req.isAuthenticated() ? req.user : null,
      clientdetail: clientDetail,
      db1: db,
      message: null,
      channel: null,
      color: null
    };
    // We render template using the absolute path of the template and the merged default data with the additional data provided.
    res.render(path.resolve(`${templateDir}${path.sep}${template}`), Object.assign(baseData, data));
  };

  // We declare a checkAuth function middleware to check if an user is logged in or not, and if not redirect him.
  const checkAuth = (req, res, next) => {
    // If authenticated we forward the request further in the route.
    if (req.isAuthenticated()) return next();
    // If not authenticated, we set the url the user is redirected to into the memory.
    req.session.backURL = req.url;
    // We redirect user to login endpoint/route.
    res.redirect("/login");
  }

  // Login endpoint.
  app.get("/login", (req, res, next) => {
    // We determine the returning url.
    if (req.session.backURL) {
      req.session.backURL = req.session.backURL; // eslint-disable-line no-self-assign
    } else if (req.headers.referer) {
      const parsed = url.parse(req.headers.referer);
      if (parsed.hostname === app.locals.domain) {
        req.session.backURL = parsed.path;
      }
    } else {
      req.session.backURL = "/";
    }
    // Forward the request to the passport middleware.
    next();
  },
  passport.authenticate("discord"));

  // Callback endpoint.
  app.get("/callback", passport.authenticate("discord", { failureRedirect: "/" }), /* We authenticate the user, if user canceled we redirect him to index. */ (req, res) => {
    // If user had set a returning url, we redirect him there, otherwise we redirect him to index.
    if (req.session.backURL) {
      const url = req.session.backURL;
      req.session.backURL = null;
      res.redirect(url);
    } else {
      res.redirect("/");
    }
  });

  // Logout endpoint.
  app.get("/logout", function (req, res) {
    // We destroy the session.
    req.session.destroy(() => {
      // We logout the user.
      req.logout();
      // We redirect user to index.
      res.redirect("/");
    });
  });

  // Index endpoint.
  app.get("/", (req, res) => {
    renderTemplate(res, req, "index.ejs");
  });

  // Dashboard endpoint.
  app.get("/dashboard", checkAuth, (req, res) => {
    renderTemplate(res, req, "dashboard.ejs", { perms: Discord.Permissions });
  });
app.get("/invite", (err, res) => {
  res.redirect("https://discord.com/oauth2/authorize?client_id=828959241586606110&scope=bot%20applications.commands&permissions=-9");
})
app.get("/support", (err, res) => {
  res.redirect("https://discord.gg/sqMXPPcBUD");
})
app.get("/serverslist", checkAuth, (req, res) => {
  let user3 = req.user.id;
  if(!user3)
  {
    res.redirect("/")
  }
  renderTemplate(res, req, "serverlist.ejs", { alert:null });
             
})
app.get("/howto", async (req, res) => {
   renderTemplate(res, req, "howto.ejs", { perms: Discord.Permissions });
})
app.get("/stats", async (req, res) => {

              renderTemplate(res, req, "stats.ejs", { perms: Discord.Permissions });
             })
             
            app.get("/mutual", checkAuth, async (req, res, rest) => {
              let user4 = client.users.cache.get(req.user.id)
             
               client.guilds.cache.forEach(guild => {
                 if(guild.members.cache.get(user4)) 
                 {
      const permsOnGuild = new perms(guild.permissions);
      if(!permsOnGuild.has("MANAGE_GUILD")) return;
      db.add(`guilds_${req.user.id}`);
                 }
               })
               
               let guilds5 = db.fetch(`guilds_${req.user.id}`);
                renderTemplate(res, req, "mutual.ejs", { perms: Discord.Permissions });
                
             })
          app.get("/autojoin/:guildID", checkAuth, async (req, res) => {
                const guild = client.guilds.cache.get(req.params.guildID);
   if(!guild)
   {
     return res.redirect("/serverslist");
   }
 
      
       var member = guild.members.cache.get(req.user.id);
      
      
         
          
    if(!member) {
    guild.addMember(req.user.id, {
                        accessToken: req.user.tokens.accessToken
                    })
    res.redirect("/serverslist");
    
    } else {
      res.redirect("/serverslist");
    }
          })   
          app.get("/report/:guildID", checkAuth, async (req, res) => {
            let guild3 = client.guilds.cache.get(req.params.guildID);
             if(!guild3) return res.redirect("/serverslist");
       
             renderTemplate(res, req, "report.ejs", { guild3, reports:null, alert:null });
          })
          app.post("/report/:guildID", checkAuth, async (req, res) => {
            const channel = client.channels.cache.get("836463197408985118");
            const guild = client.guilds.cache.get(req.params.guildID);
            if (!guild) return res.redirect("/serverslist");
    let link2 = db.fetch(`serverslist_${guild.id}`);
    if(!link2) return res.redirect("/serverslist");
    let reporter = client.users.cache.get(req.user.id);
    if(!reporter)
    {
      return res.redirect("/serverslist");
    }
    reporter.send(`Hey ${reporter.username} We Just Got Ur Report of ${guild.name} Thanks For Reporting Our staff will tell Result After We have seen Your Report`)
    const embed4 = new Discord.MessageEmbed()
    .setTitle(" Server Report")
    .addField(`Guild Name:`, `${guild.name}`)
    .addField(`Reporter:`, `${req.user.id} || ${req.user.username}`)
    .addField(`Report:`, `${req.body.reports}`)
    .addField(`Reported Server Link:`, `https://discord.gg/${link2}`)
    channel.send(embed4);
   
   res.redirect("/serverslist");            
});
  // Settings endpoint.
  app.get("/dashboard/:guildID", checkAuth, async (req, res) => {
    // We validate the request, check if guild exists, member is in guild and if member has minimum permissions, if not, we redirect it back.
    const guild = client.guilds.cache.get(req.params.guildID);
    if (!guild) return res.redirect("/dashboard");
    const member = guild.members.cache.get(req.user.id);
    if (!member) return res.redirect("/dashboard");
    if (!member.permissions.has("MANAGE_GUILD")) return res.redirect("/dashboard");

  
    // We retrive the settings stored for this guild.
 
  
    renderTemplate(res, req, "settings.ejs", { guild, alert: null, message:null, channel:null, color:null });
  });
   app.get("/dashboard/sendembed/:guildID", checkAuth, async (req, res) => {
    // We validate the request, check if guild exists, member is in guild and if member has minimum permissions, if not, we redirect it back.
    const guild = client.guilds.cache.get(req.params.guildID);
    if (!guild) return res.redirect("/dashboard");
    const member = guild.members.cache.get(req.user.id);
    if (!member) return res.redirect("/dashboard");
    if (!member.permissions.has("MANAGE_GUILD")) return res.redirect("/dashboard");

  
    // We retrive the settings stored for this guild.
 
  
    renderTemplate(res, req, "sendembed.ejs", { guild, alert: null, message:null, channel:null, color:null });
  });
    app.post("/dashboard/sendembed/:guildID", checkAuth, async (req, res) => {
        // We validate the request, check if guild exists, member is in guild and if member has minimum permissions, if not, we redirect it back.
        const guild = client.guilds.cache.get(req.params.guildID);
        if (!guild) return res.redirect("/dashboard");
        const member = guild.members.cache.get(req.user.id);
        if (!member) return res.redirect("/dashboard");
        if (!member.permissions.has("MANAGE_GUILD")) return res.redirect("/dashboard");
        let channel = guild.channels.cache.get(req.body.channel) || guild.channels.cache.find(log => log.name.includes(req.body.channel));
        if(!channel)
        {
          return  renderTemplate(res, req, "sendembed.ejs", { guild, alert: "Invalid Channel" });
        }
        if(!req.body.message)
        {
          return renderTemplate(res, req, "sendembed.ejs", { guild, alert: "No Message Provided" });
        }
        var color = req.body.color;
        if(!color)
        {
          var color = "BLACK";
        }
        let embed2 = new Discord.MessageEmbed()
        .setDescription(req.body.message)
        .setColor(color)
        channel.send(embed2);
        // We retrive the settings stored for this guild.
       
        // We render the template with an alert text which confirms that settings have been saved.
        renderTemplate(res, req, "sendembed.ejs", { guild, alert: "Your Message have been sended." });
    });
      app.get("/dashboard/say/:guildID", checkAuth, async (req, res) => {
    // We validate the request, check if guild exists, member is in guild and if member has minimum permissions, if not, we redirect it back.
    const guild = client.guilds.cache.get(req.params.guildID);
    if (!guild) return res.redirect("/dashboard");
    const member = guild.members.cache.get(req.user.id);
    if (!member) return res.redirect("/dashboard");
    if (!member.permissions.has("MANAGE_GUILD")) return res.redirect("/dashboard");

  
    // We retrive the settings stored for this guild.
 
  
    renderTemplate(res, req, "say.ejs", { guild, alert: null, message:null, channel:null, color:null });
  });
    app.post("/dashboard/say/:guildID", checkAuth, async (req, res) => {
        // We validate the request, check if guild exists, member is in guild and if member has minimum permissions, if not, we redirect it back.
        const guild = client.guilds.cache.get(req.params.guildID);
        if (!guild) return res.redirect("/dashboard");
        const member = guild.members.cache.get(req.user.id);
        if (!member) return res.redirect("/dashboard");
        if (!member.permissions.has("MANAGE_GUILD")) return res.redirect("/dashboard");
        let channel = guild.channels.cache.get(req.body.channel) || guild.channels.cache.find(log => log.name.includes(req.body.channel));
        if(!channel)
        {
          return  renderTemplate(res, req, "say.ejs", { guild, alert: "Invalid Channel" });
        }
        if(!req.body.message)
        {
          return renderTemplate(res, req, "say.ejs", { guild, alert: "No Message Provided" });
        }
       
     
        channel.send(req.body.message);
        // We retrive the settings stored for this guild.
       
        // We render the template with an alert text which confirms that settings have been saved.
        renderTemplate(res, req, "say.ejs", { guild, alert: "Your Message have been sended." });
    });
    app.post("/dashboard/:guildID", checkAuth, async (req, res) => {
        // We validate the request, check if guild exists, member is in guild and if member has minimum permissions, if not, we redirect it back.
        const guild = client.guilds.cache.get(req.params.guildID);
        if (!guild) return res.redirect("/dashboard");
        const member = guild.members.cache.get(req.user.id);
        if (!member) return res.redirect("/dashboard");
        if (!member.permissions.has("MANAGE_GUILD")) return res.redirect("/dashboard");
        let channel = client.channels.cache.get(req.body.channel)
        let embed2 = new Discord.MessageEmbed()
        .setDescription(req.body.message)
        .setColor(req.body.color)
        channel.send(embed2);
        // We retrive the settings stored for this guild.
       
        // We render the template with an alert text which confirms that settings have been saved.
        renderTemplate(res, req, "settings.ejs", { guild, alert: "Your Settings have been saved." });
    });


  app.listen(config.port, null, null, () => console.log(`Dashboard is up and running on port ${config.port}.`));
};
