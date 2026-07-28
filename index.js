const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { DisTube } = require('distube');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { YtDlpPlugin } = require('@distube/yt-dlp');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const PREFIX = '!';

// Khởi tạo DisTube với các tính năng cao cấp
const distube = new DisTube(client, {
  emitNewSongOnly: true,
  leaveOnEmpty: true,       // Tự rời phòng khi không có ai
  emptyCooldown: 30,        // Đợi 30 giây trước khi rời
  leaveOnFinish: false,     // Ở lại phòng khi hết nhạc (chờ bài mới)
  leaveOnStop: false,
  plugins: [
    new SpotifyPlugin({
      api: {
        clientId: process.env.SPOTIFY_CLIENT_ID || undefined,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET || undefined,
      },
    }),
    new SoundCloudPlugin(),
    new YtDlpPlugin(),
  ],
  customFilters: {
    bassboost: 'bass=g=20',
    nightcore: 'aresample=48000,asetrate=48000*1.25',
    vaporwave: 'aresample=48000,asetrate=48000*0.8',
    karaoke: 'stereotools=mlev=0.015625',
  }
});

client.on('ready', () => {
  console.log(`🤖 Bot Jockie (Bản Việt) đã sẵn sàng: ${client.user.tag}`);
  client.user.setActivity('🎶 !p <tên bài hát>', { type: 2 });
});

// ==========================================
// HỆ THỐNG XỬ LÝ NÚT BẤM (BUTTON TƯƠNG TÁC)
// ==========================================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  
  const queue = distube.getQueue(interaction.guildId);
  if (!queue) return interaction.reply({ content: '❌ Không có bài hát nào đang phát!', ephemeral: true });

  try {
    await interaction.deferUpdate(); // Chặn lỗi "Interaction Failed"
    
    switch (interaction.customId) {
      case 'btn_pause_resume':
        if (queue.paused) queue.resume();
        else queue.pause();
        break;
      case 'btn_skip':
        if (queue.songs.length <= 1 && !queue.autoplay) {
          queue.stop();
        } else {
          await queue.skip();
        }
        break;
      case 'btn_stop':
        queue.stop();
        break;
      case 'btn_loop':
        const nextMode = queue.repeatMode === 0 ? 1 : queue.repeatMode === 1 ? 2 : 0;
        queue.setRepeatMode(nextMode);
        break;
      case 'btn_autoplay':
        queue.toggleAutoplay();
        break;
    }
  } catch (error) {
    console.error(error);
  }
});

// ==========================================
// HỆ THỐNG LỆNH (COMMANDS)
// ==========================================
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();
  const voiceChannel = message.member.voice.channel;

  // 1. Lệnh Phát Nhạc
  if (command === 'play' || command === 'p') {
    if (!voiceChannel) return message.reply('❌ Bạn cần tham gia một kênh thoại trước!');
    const query = args.join(' ');
    if (!query) return message.reply('❌ Vui lòng nhập link hoặc tên bài hát!');

    const waitMsg = await message.reply('🔍 **Đang tìm kiếm và xử lý...**');
    distube.play(voiceChannel, query, {
      textChannel: message.channel,
      member: message.member,
      message: message
    });
    setTimeout(() => waitMsg.delete().catch(()=>console.log("Error delete msg")), 3000);
  }

  // 2. Chế độ Tự động phát (Autoplay)
  else if (command === 'autoplay' || command === 'ap') {
    const queue = distube.getQueue(message);
    if (!queue) return message.reply('❌ Không có bài hát nào đang phát!');
    const mode = queue.toggleAutoplay();
    message.reply(`🔄 **Autoplay:** \`${mode ? 'BẬT' : 'TẮT'}\``);
  }

  // 3. Bộ lọc âm thanh (Filters)
  else if (command === 'filter') {
    const queue = distube.getQueue(message);
    if (!queue) return message.reply('❌ Không có bài hát nào đang phát!');
    const filter = args[0]?.toLowerCase();
    
    if (!filter || !['bassboost', 'nightcore', 'vaporwave', 'karaoke', 'off'].includes(filter)) {
      return message.reply('💡 **Các bộ lọc khả dụng:** `bassboost`, `nightcore`, `vaporwave`, `karaoke`, `off` (Tắt)\n👉 Dùng: `!filter nightcore`');
    }

    if (filter === 'off') queue.filters.clear();
    else queue.filters.has(filter) ? queue.filters.remove(filter) : queue.filters.add(filter);
    
    message.reply(`🎛️ **Bộ lọc âm thanh:** \`${filter === 'off' ? 'Đã tắt' : filter}\``);
  }

  // 4. Tua nhạc (Seek)
  else if (command === 'seek') {
    const queue = distube.getQueue(message);
    if (!queue) return message.reply('❌ Không có nhạc đang phát!');
    const time = Number(args[0]);
    if (isNaN(time)) return message.reply('❌ Vui lòng nhập số giây muốn tua tới (VD: `!seek 60`)');
    queue.seek(time);
    message.reply(`⏩ **Đã tua tới:** \`${time} giây\``);
  }

  // Các lệnh cơ bản khác (Skip, Stop, Queue)
  else if (command === 'skip' || command === 's') {
    const queue = distube.getQueue(message);
    if (!queue) return;
    if (queue.songs.length <= 1 && !queue.autoplay) queue.stop();
    else distube.skip(message);
  }
  else if (command === 'stop' || command === 'dc') {
    const queue = distube.getQueue(message);
    if (queue) queue.stop();
  }
  else if (command === 'queue' || command === 'q') {
    const queue = distube.getQueue(message);
    if (!queue) return message.reply('❌ Hàng chờ trống!');
    const qList = queue.songs.slice(0, 10).map((s, i) => `${i === 0 ? '▶️' : `**${i}.**`} ${s.name} - \`${s.formattedDuration}\``).join('\n');
    const embed = new EmbedBuilder().setTitle('🎶 Hàng Chờ').setDescription(qList).setColor('#5865F2');
    message.reply({ embeds: [embed] });
  }
});

// ==========================================
// SỰ KIỆN DISTUBE (TẠO DASHBOARD JOCKIE)
// ==========================================
distube
  .on('playSong', (queue, song) => {
    // Tạo bảng điều khiển Embed như Jockie Music
    const embed = new EmbedBuilder()
      .setColor('#2F3136')
      .setAuthor({ name: '| 🎵 Đang phát nhạc', iconURL: 'https://cdn-icons-png.flaticon.com/512/4762/4762295.png' })
      .setTitle(song.name)
      .setURL(song.url)
      .setThumbnail(song.thumbnail)
      .addFields(
        { name: '⏱️ Thời lượng', value: `\`${song.formattedDuration}\``, inline: true },
        { name: '👤 Yêu cầu bởi', value: `${song.user}`, inline: true },
        { name: '🎛️ Bộ lọc', value: `\`${queue.filters.names.join(', ') || 'Không'}\``, inline: true }
      )
      .setFooter({ text: `Âm lượng: ${queue.volume}% | Autoplay: ${queue.autoplay ? 'Bật' : 'Tắt'}` });

    // Tạo dãy nút bấm (Buttons)
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_pause_resume').setLabel('⏯️ Pause/Play').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('btn_skip').setLabel('⏭️ Skip').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_stop').setLabel('⏹️ Stop').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('btn_loop').setLabel('🔄 Loop').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('btn_autoplay').setLabel('∞ Autoplay').setStyle(ButtonStyle.Secondary)
    );

    queue.textChannel.send({ embeds: [embed], components: [row] });
  })
  .on('addSong', (queue, song) => {
    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setDescription(`✅ Đã thêm [${song.name}](${song.url}) - \`${song.formattedDuration}\` vào hàng chờ bởi ${song.user}`);
    queue.textChannel.send({ embeds: [embed] });
  })
  .on('addList', (queue, playlist) => {
    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setDescription(`✅ Đã thêm playlist **[${playlist.name}](${playlist.url})** (${playlist.songs.length} bài) vào hàng chờ!`);
    queue.textChannel.send({ embeds: [embed] });
  })
  .on('empty', queue => {
    queue.textChannel.send('👋 Kênh thoại đang trống, bot đã tự động rời đi để tiết kiệm pin!');
  })
  .on('error', (channel, e) => {
    if (channel) channel.send(`❌ **Lỗi:** \`${e.message.slice(0, 100)}\``);
    console.error(e);
  });

client.login(process.env.DISCORD_TOKEN);
