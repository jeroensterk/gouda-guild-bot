// Gouda Guild Application Bot
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// Initialize Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Configuration - you'll need to customize these values
const CONFIG = {
  token: process.env.BOT_TOKEN, // Replace with your bot token
  applicationChannelId: "1347236773029347491", // Channel where applications are submitted
  officerChannelId: "1347233612680134666", // Channel where officers review applications
  officerRoleId: "1292012074104524820", // Role ID for "Oude kaas" role
  dataFile: path.join(__dirname, "applications.json"), // File to store applications
};

// Application data storage
let applications = [];

// Load existing applications from file
function loadApplications() {
  try {
    if (fs.existsSync(CONFIG.dataFile)) {
      const data = fs.readFileSync(CONFIG.dataFile, "utf8");
      applications = JSON.parse(data);
      console.log(`Loaded ${applications.length} applications from file.`);
    } else {
      saveApplications(); // Create the file if it doesn't exist
    }
  } catch (error) {
    console.error("Error loading applications:", error);
  }
}

// Save applications to file
function saveApplications() {
  try {
    fs.writeFileSync(
      CONFIG.dataFile,
      JSON.stringify(applications, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("Error saving applications:", error);
  }
}

// Bot is ready
client.once("ready", () => {
  console.log(`Bot is online as ${client.user.tag}!`);
  loadApplications();
});

// Register slash commands when the bot joins a guild
client.on("guildCreate", async (guild) => {
  try {
    await registerCommands(guild.id);
    console.log(`Registered commands for guild: ${guild.name}`);
  } catch (error) {
    console.error(
      `Failed to register commands for guild ${guild.name}:`,
      error
    );
  }
});

// Handle interactions (buttons, modals, slash commands)
client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isCommand()) {
      await handleCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
  } catch (error) {
    console.error("Error handling interaction:", error);

    // Try to respond to the user if possible
    try {
      const message = "An error occurred while processing your request.";
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: message, ephemeral: true });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    } catch (replyError) {
      console.error("Error sending error response:", replyError);
    }
  }
});

// Register slash commands
async function registerCommands(guildId) {
  const commands = [
    {
      name: "apply",
      description: "Apply to join the Gouda guild",
    },
    {
      name: "applications",
      description: "View the current application queue (Officer only)",
    },
    {
      name: "next",
      description: "Process the next application in the queue (Officer only)",
    },
    {
      name: "accept",
      description: "Accept an applicant (Officer only)",
      options: [
        {
          name: "user",
          description: "The user to accept",
          type: 6, // USER type
          required: true,
        },
      ],
    },
    {
      name: "reject",
      description: "Reject an applicant (Officer only)",
      options: [
        {
          name: "user",
          description: "The user to reject",
          type: 6, // USER type
          required: true,
        },
        {
          name: "reason",
          description: "Reason for rejection",
          type: 3, // STRING type
          required: false,
        },
      ],
    },
  ];

  try {
    const rest = new (require("@discordjs/rest").REST)({
      version: "10",
    }).setToken(CONFIG.token);
    const Routes = require("discord-api-types/v10").Routes;

    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
      body: commands,
    });
  } catch (error) {
    console.error("Error registering commands:", error);
    throw error;
  }
}

// Handle slash commands
async function handleCommand(interaction) {
  const { commandName } = interaction;

  switch (commandName) {
    case "apply":
      await showApplicationModal(interaction);
      break;
    case "applications":
      await viewApplicationQueue(interaction);
      break;
    case "next":
      await processNextApplication(interaction);
      break;
    case "accept":
      await acceptApplicant(interaction);
      break;
    case "reject":
      await rejectApplicant(interaction);
      break;
    default:
      await interaction.reply({ content: "Unknown command", ephemeral: true });
  }
}

// Create and show the application modal
async function showApplicationModal(interaction) {
  // Create the modal
  const modal = new ModalBuilder()
    .setCustomId("application-modal")
    .setTitle("Gouda Guild Application");

  // Add text input components
  const ignInput = new TextInputBuilder()
    .setCustomId("ign")
    .setLabel("What's your in-game name (IGN)?")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const weaponInput = new TextInputBuilder()
    .setCustomId("weapon")
    .setLabel("What's your main weapon combo?")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const gearscoreInput = new TextInputBuilder()
    .setCustomId("gearscore")
    .setLabel("What's your current gearscore?")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const hoursInput = new TextInputBuilder()
    .setCustomId("hours")
    .setLabel("How many hours do you play per day on average?")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const availabilityInput = new TextInputBuilder()
    .setCustomId("availability")
    .setLabel("Can you attend Boonstone, Riftstone & Siege?")
    .setPlaceholder("Answer if you can attend most of these events")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  // Create a second modal for additional questions
  const modal2 = new ModalBuilder()
    .setCustomId("application-modal-2")
    .setTitle("Gouda Guild Application (Part 2)");

  const pvpInput = new TextInputBuilder()
    .setCustomId("pvp")
    .setLabel("Are you PvP focused? What experience do you have?")
    .setPlaceholder("Describe your PvP focus and experience in other games")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  // Store user ID in the client to track who is in the application process
  client.pendingApplications = client.pendingApplications || new Map();

  // Add inputs to the modal
  const firstActionRow = new ActionRowBuilder().addComponents(ignInput);
  const secondActionRow = new ActionRowBuilder().addComponents(weaponInput);
  const thirdActionRow = new ActionRowBuilder().addComponents(gearscoreInput);
  const fourthActionRow = new ActionRowBuilder().addComponents(hoursInput);
  const fifthActionRow = new ActionRowBuilder().addComponents(
    availabilityInput
  );

  modal.addComponents(
    firstActionRow,
    secondActionRow,
    thirdActionRow,
    fourthActionRow,
    fifthActionRow
  );

  // Store the second modal for use after the first is submitted
  client.pendingApplications.set(interaction.user.id, {
    modal2: modal2,
    pvpInput: pvpInput,
  });

  // Show the modal
  await interaction.showModal(modal);
}

// Process the application form submission
async function handleModalSubmit(interaction) {
  if (interaction.customId === "application-modal") {
    // Get the data entered by the user
    const ign = interaction.fields.getTextInputValue("ign");
    const weapon = interaction.fields.getTextInputValue("weapon");
    const gearscore = interaction.fields.getTextInputValue("gearscore");
    const hours = interaction.fields.getTextInputValue("hours");
    const availability = interaction.fields.getTextInputValue("availability");

    // Store the first part of the application data
    client.pendingApplications.get(interaction.user.id).data = {
      ign,
      weapon,
      gearscore,
      hours,
      availability,
    };

    // Show the second modal to get PvP information
    const { modal2, pvpInput } = client.pendingApplications.get(
      interaction.user.id
    );

    // Add the PvP input to the second modal
    const pvpActionRow = new ActionRowBuilder().addComponents(pvpInput);
    modal2.addComponents(pvpActionRow);

    // Show the second part of the application form
    await interaction.reply({
      content: "Please complete the second part of your application:",
      ephemeral: true,
    });
    return await interaction.showModal(modal2);
  }

  if (interaction.customId === "application-modal-2") {
    // Get the PvP data entered by the user
    const pvp = interaction.fields.getTextInputValue("pvp");

    // Get the previously stored application data
    const userData = client.pendingApplications.get(interaction.user.id);

    // Create a new application with all the data
    const application = {
      id: Date.now().toString(),
      userId: interaction.user.id,
      username: interaction.user.username,
      timestamp: new Date().toISOString(),
      status: "pending",
      data: {
        ...userData.data,
        pvp,
      },
    };

    // Add the application to the queue
    applications.push(application);
    saveApplications();

    // Create a confirmation embed
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("Application Submitted")
      .setDescription(
        `Thank you for applying to the Gouda guild, <@${interaction.user.id}>!`
      )
      .addFields(
        { name: "IGN", value: application.data.ign, inline: true },
        { name: "Weapon Combo", value: application.data.weapon, inline: true },
        { name: "Gearscore", value: application.data.gearscore, inline: true },
        { name: "Hours Per Day", value: application.data.hours, inline: true },
        { name: "Availability", value: application.data.availability },
        { name: "PvP Focus & Experience", value: application.data.pvp }
      )
      .setFooter({ text: `Application ID: ${application.id}` })
      .setTimestamp();

    // Notify the user that their application has been submitted
    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Send the application to the officer channel
    const officerChannel = client.channels.cache.get(CONFIG.officerChannelId);
    if (officerChannel) {
      const position =
        applications
          .filter((app) => app.status === "pending")
          .findIndex((app) => app.id === application.id) + 1;

      const officerEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("New Guild Application")
        .setDescription(
          `<@${interaction.user.id}> has applied to join the guild.`
        )
        .addFields(
          { name: "IGN", value: application.data.ign, inline: true },
          {
            name: "Weapon Combo",
            value: application.data.weapon,
            inline: true,
          },
          {
            name: "Gearscore",
            value: application.data.gearscore,
            inline: true,
          },
          {
            name: "Hours Per Day",
            value: application.data.hours,
            inline: true,
          },
          { name: "Availability", value: application.data.availability },
          { name: "PvP Focus & Experience", value: application.data.pvp },
          { name: "Queue Position", value: `#${position}`, inline: true }
        )
        .setFooter({ text: `Application ID: ${application.id}` })
        .setTimestamp();

      // Add buttons for officers to take action
      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`accept-${application.id}`)
          .setLabel("Accept")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject-${application.id}`)
          .setLabel("Reject")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`request-screenshot-${application.id}`)
          .setLabel("Request Screenshot")
          .setStyle(ButtonStyle.Primary)
      );

      await officerChannel.send({
        embeds: [officerEmbed],
        components: [actionRow],
      });
    }

    // Remind the user about the screenshot
    setTimeout(async () => {
      try {
        // Create a DM channel with the user
        const dmChannel = await interaction.user.createDM();

        // Send the screenshot reminder
        await dmChannel.send({
          content:
            "Thank you for your Gouda guild application! Please don't forget to provide a screenshot of your build showing your full character page, detailed stats, and if possible, skill loadout and masteries. You can upload it in the application channel or send it to an officer directly.",
        });
      } catch (error) {
        console.error("Error sending DM reminder:", error);
      }
    }, 5000); // 5 second delay
  }
}

// Handle button interactions
async function handleButton(interaction) {
  const customId = interaction.customId;

  // Check if user is an officer
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const isOfficer = member.roles.cache.has(CONFIG.officerRoleId);

  if (!isOfficer) {
    return interaction.reply({
      content: "You do not have permission to use this button.",
      ephemeral: true,
    });
  }

  if (customId.startsWith("accept-")) {
    const applicationId = customId.replace("accept-", "");
    await acceptApplicationById(interaction, applicationId);
  } else if (customId.startsWith("reject-")) {
    const applicationId = customId.replace("reject-", "");
    await rejectApplicationById(interaction, applicationId);
  } else if (customId.startsWith("request-screenshot-")) {
    const applicationId = customId.replace("request-screenshot-", "");
    await requestScreenshot(interaction, applicationId);
  }
}

// View the application queue
async function viewApplicationQueue(interaction) {
  // Check if user is an officer
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const isOfficer = member.roles.cache.has(CONFIG.officerRoleId);

  if (!isOfficer) {
    return interaction.reply({
      content: "You do not have permission to use this command.",
      ephemeral: true,
    });
  }

  const pendingApplications = applications.filter(
    (app) => app.status === "pending"
  );

  if (pendingApplications.length === 0) {
    return interaction.reply({
      content: "There are no pending applications.",
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("Pending Guild Applications")
    .setDescription(
      `There are ${pendingApplications.length} applications waiting for review.`
    )
    .setTimestamp();

  // Add the first 10 applications to the embed
  const displayApps = pendingApplications.slice(0, 10);
  displayApps.forEach((app, index) => {
    embed.addFields({
      name: `#${index + 1}: ${app.data.ign} (${app.username})`,
      value: `GS: ${app.data.gearscore} | Weapons: ${
        app.data.weapon
      } | Applied: <t:${Math.floor(
        new Date(app.timestamp).getTime() / 1000
      )}:R>`,
    });
  });

  if (pendingApplications.length > 10) {
    embed.setFooter({
      text: `...and ${pendingApplications.length - 10} more applications`,
    });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Process the next application in the queue
async function processNextApplication(interaction) {
  // Check if user is an officer
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const isOfficer = member.roles.cache.has(CONFIG.officerRoleId);

  if (!isOfficer) {
    return interaction.reply({
      content: "You do not have permission to use this command.",
      ephemeral: true,
    });
  }

  const nextApp = applications.find((app) => app.status === "pending");

  if (!nextApp) {
    return interaction.reply({
      content: "There are no pending applications.",
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("Next Application in Queue")
    .setDescription(`Application from <@${nextApp.userId}>`)
    .addFields(
      { name: "IGN", value: nextApp.data.ign, inline: true },
      { name: "Weapon Combo", value: nextApp.data.weapon, inline: true },
      { name: "Gearscore", value: nextApp.data.gearscore, inline: true },
      { name: "Hours Per Day", value: nextApp.data.hours, inline: true },
      { name: "Availability", value: nextApp.data.availability },
      { name: "PvP Focus & Experience", value: nextApp.data.pvp },
      {
        name: "Applied",
        value: `<t:${Math.floor(
          new Date(nextApp.timestamp).getTime() / 1000
        )}:R>`,
        inline: true,
      }
    )
    .setFooter({ text: `Application ID: ${nextApp.id}` })
    .setTimestamp();

  // Add buttons for officers to take action
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`accept-${nextApp.id}`)
      .setLabel("Accept")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`reject-${nextApp.id}`)
      .setLabel("Reject")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`request-screenshot-${nextApp.id}`)
      .setLabel("Request Screenshot")
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.reply({
    embeds: [embed],
    components: [actionRow],
    ephemeral: false,
  });
}

// Accept an applicant by ID
async function acceptApplicationById(interaction, applicationId) {
  const appIndex = applications.findIndex((app) => app.id === applicationId);

  if (appIndex === -1) {
    return interaction.reply({
      content: "Application not found.",
      ephemeral: true,
    });
  }

  const application = applications[appIndex];

  // Update application status
  application.status = "accepted";
  application.processedBy = interaction.user.id;
  application.processedAt = new Date().toISOString();

  saveApplications();

  // Disable the buttons on the original message
  try {
    const actionRow = ActionRowBuilder.from(
      interaction.message.components[0]
    ).setComponents(
      interaction.message.components[0].components.map((button) => {
        return ButtonBuilder.from(button).setDisabled(true);
      })
    );

    await interaction.update({ components: [actionRow] });
  } catch (error) {
    console.error("Error updating buttons:", error);
  }

  // Notify the applicant
  try {
    const user = await client.users.fetch(application.userId);
    await user.send({
      content: `Congratulations! Your application to join the Gouda guild has been accepted. Please contact <@${interaction.user.id}> for next steps.`,
    });
  } catch (error) {
    console.error("Error sending DM to accepted applicant:", error);
  }

  // Confirm in the officer channel
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("Application Accepted")
    .setDescription(
      `<@${interaction.user.id}> has accepted the application from <@${application.userId}> (${application.data.ign}).`
    )
    .setTimestamp();

  await interaction.followUp({ embeds: [embed] });
}

// Reject an applicant by ID
async function rejectApplicationById(interaction, applicationId) {
  const appIndex = applications.findIndex((app) => app.id === applicationId);

  if (appIndex === -1) {
    return interaction.reply({
      content: "Application not found.",
      ephemeral: true,
    });
  }

  const application = applications[appIndex];

  // Update application status
  application.status = "rejected";
  application.processedBy = interaction.user.id;
  application.processedAt = new Date().toISOString();

  saveApplications();

  // Disable the buttons on the original message
  try {
    const actionRow = ActionRowBuilder.from(
      interaction.message.components[0]
    ).setComponents(
      interaction.message.components[0].components.map((button) => {
        return ButtonBuilder.from(button).setDisabled(true);
      })
    );

    await interaction.update({ components: [actionRow] });
  } catch (error) {
    console.error("Error updating buttons:", error);
  }

  // Notify the applicant
  try {
    const user = await client.users.fetch(application.userId);
    await user.send({
      content: `We're sorry, but your application to join the Gouda guild has been declined at this time. You may apply again in the future when your character meets our requirements.`,
    });
  } catch (error) {
    console.error("Error sending DM to rejected applicant:", error);
  }

  // Confirm in the officer channel
  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("Application Rejected")
    .setDescription(
      `<@${interaction.user.id}> has rejected the application from <@${application.userId}> (${application.data.ign}).`
    )
    .setTimestamp();

  await interaction.followUp({ embeds: [embed] });
}

// Accept an applicant with slash command
async function acceptApplicant(interaction) {
  // Check if user is an officer
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const isOfficer = member.roles.cache.has(CONFIG.officerRoleId);

  if (!isOfficer) {
    return interaction.reply({
      content: "You do not have permission to use this command.",
      ephemeral: true,
    });
  }

  const targetUser = interaction.options.getUser("user");
  const application = applications.find(
    (app) => app.userId === targetUser.id && app.status === "pending"
  );

  if (!application) {
    return interaction.reply({
      content: "No pending application found for this user.",
      ephemeral: true,
    });
  }

  // Update application status
  application.status = "accepted";
  application.processedBy = interaction.user.id;
  application.processedAt = new Date().toISOString();

  saveApplications();

  // Notify the applicant
  try {
    await targetUser.send({
      content: `Congratulations! Your application to join the Gouda guild has been accepted. Please contact <@${interaction.user.id}> for next steps.`,
    });
  } catch (error) {
    console.error("Error sending DM to accepted applicant:", error);
  }

  // Confirm in the channel
  await interaction.reply({
    content: `Application from ${targetUser.username} (${application.data.ign}) has been accepted.`,
  });
}

// Reject an applicant with slash command
async function rejectApplicant(interaction) {
  // Check if user is an officer
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const isOfficer = member.roles.cache.has(CONFIG.officerRoleId);

  if (!isOfficer) {
    return interaction.reply({
      content: "You do not have permission to use this command.",
      ephemeral: true,
    });
  }

  const targetUser = interaction.options.getUser("user");
  const reason =
    interaction.options.getString("reason") || "No reason provided.";
  const application = applications.find(
    (app) => app.userId === targetUser.id && app.status === "pending"
  );

  if (!application) {
    return interaction.reply({
      content: "No pending application found for this user.",
      ephemeral: true,
    });
  }

  // Update application status
  application.status = "rejected";
  application.processedBy = interaction.user.id;
  application.processedAt = new Date().toISOString();
  application.rejectionReason = reason;

  saveApplications();

  // Notify the applicant
  try {
    await targetUser.send({
      content: `We're sorry, but your application to join the Gouda guild has been declined at this time. Reason: ${reason}`,
    });
  } catch (error) {
    console.error("Error sending DM to rejected applicant:", error);
  }

  // Confirm in the channel
  await interaction.reply({
    content: `Application from ${targetUser.username} (${application.data.ign}) has been rejected. Reason: ${reason}`,
  });
}

// Request screenshot from an applicant
async function requestScreenshot(interaction, applicationId) {
  const application = applications.find((app) => app.id === applicationId);

  if (!application) {
    return interaction.reply({
      content: "Application not found.",
      ephemeral: true,
    });
  }

  // Notify the applicant
  try {
    const user = await client.users.fetch(application.userId);
    await user.send({
      content: `Hello! Thank you for your application to the Gouda guild. Could you please provide a screenshot of your build showing your full character page, detailed stats, and if possible, skill loadout and masteries? This will help us better evaluate your application.`,
    });
  } catch (error) {
    console.error("Error sending screenshot request to applicant:", error);
  }

  // Confirm to the officer
  await interaction.reply({
    content: `Screenshot request sent to <@${application.userId}> (${application.data.ign}).`,
    ephemeral: true,
  });
}

// Login to Discord
client.login(CONFIG.token);
