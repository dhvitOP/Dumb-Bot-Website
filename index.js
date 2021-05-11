/*
  > Index.Js is the entry point of our application.
*/
// We import the modules.
const Discord = require("discord.js");
const mongoose = require("mongoose");
const config = require("./config.js");
const GuildSettings = require("./models/settings");
const Dashboard = require("./dashboard/dashboard");
const db = require("quick.db");
// We instiate the client and connect to database.
const client = new Discord.Client({
  ws: {
    intents: [
      "GUILDS",
      "GUILD_MEMBERS",
      "GUILD_MESSAGES"
    ]
  }
});

mongoose.connect(config.mongodbUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
client.config = config;

// We listen for client's ready event.
client.on("ready", async () => {
  console.log("Fetching members...");

  for (const [id, guild] of client.guilds.cache) {
    await guild.members.fetch();
  }

  console.log("Fetched members.");

  console.log(`Bot is ready. (${client.guilds.cache.size} Guilds - ${client.channels.cache.size} Channels - ${client.users.cache.size} Users)`);
  Dashboard(client);
});

// We listen for message events.
client.on("message", async (message) => {
  // Declaring a reply function for easier replies - we grab all arguments provided into the function and we pass them to message.channel.send function.
  const reply = (...arguments) => message.channel.send(...arguments);

  // Doing some basic command logic.
  if (message.author.bot) return;
  if (!message.channel.permissionsFor(message.guild.me).has("SEND_MESSAGES")) return;
 
  // Retriving the guild settings from database.
  let prefix = "."

  // If the message does not start with the prefix stored in database, we ignore the message.
  if (message.content.indexOf(prefix) !== 0) return;

  // We remove the prefix from the message and process the arguments.
  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();
  if (command === "setup-list") {
     if (!message.member.hasPermission("MANAGE_GUILD"))
    {
       message.channel.send(
        "You need `MANAGE GUILD` to configure the Servers List settings!"
      );
      return;
}
     var link = await message.channel.createInvite({ maxAge: 0 });

     var link = await link.code;
  var link5 = db.fetch(`serverslist_${message.guild.id}`);
     if(link5)
     {
       return message.reply("Already have published Your server You cant do it again")
     }
    if(link || !link5) {
      const channel = client.channels.cache.get("836463197408985118");
      channel.send(`Another Guild is register on Our Servers List link of server - https://discord.gg/${link} Guld name - ${message.guild.name}`)
    db.set(`serverslist_${message.guild.id}`, link);
    message.reply("Done Now your server is visible in Public Dumb bot Server List")
    } else {
      message.reply("I dont have permission");
    }
    }
    if(command === "remove-list")
    {
        if (!message.member.hasPermission("MANAGE_GUILD"))
    {
       message.channel.send(
        "You need `MANAGE GUILD` to configure the Servers List settings!"
      );
      return;
}
     var link = db.fetch(`serverslist_${message.guild.id}`);
     if(!link)
     {
       return message.reply("You havent published your Server yet First Publish it")
     }
      db.delete(`serverslist_${message.guild.id}`);
      message.reply("Done Removed This Server from My Servers List")
    }
  
  // If command is ping we send a sample and then edit it with the latency.

  
});


// Listening for error & warn events.
client.on("error", console.error);
client.on("warn", console.warn);

// We login into the bot.
client.login(config.token);