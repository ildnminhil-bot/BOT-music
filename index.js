const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
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

// Khởi tạo bộ phát nhạc (Đã xóa dòng bị lỗi)
const distube = new DisTube(client, {
  emitNewSongOnly: true,
  plugins: [
    new SpotifyPlugin(),
    new SoundCloudPlugin(),
    new YtDlpPlugin(),
  ],
});

client.on('ready', () => {
  console.log(`🤖 Bot đã chạy thành công: ${client.user.tag}`);
});

// Xử lý các lệnh hát nhạc bằng tiếng Việt
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();
  const voiceChannel = message.member.voice.channel;

  // Lệnh phát nhạc: !p hoặc !play
  if (command === 'play' || command === 'p') {
    if (!voiceChannel) return message.reply('❌ Bạn cần vào một phòng thoại trước đã!');
    const query = args.join(' ');
    if (!query) return message.reply('❌ Hãy nhập tên bài hát hoặc dán link nhạc vào!');

    message.channel.send(`🔍 **Đang tìm:** \`${query}\`...`);
    distube.play(voiceChannel, query, { textChannel: message.channel, member: message.member });
  } 
  // Lệnh bỏ qua bài: !s hoặc !skip
  else if (command === 'skip' || command === 's') {
    const queue = distube.getQueue(message);
    if (!queue) return message.reply('❌ Không có bài hát nào đang phát!');
    distube.skip(message).catch(() => queue.stop());
    message.reply('⏭️ **Đã bỏ qua bài hát!**');
  } 
  // Lệnh tắt nhạc: !dc hoặc !stop
  else if (command === 'stop' || command === 'dc') {
    const queue = distube.getQueue(message);
    if (queue) queue.stop();
    message.reply('⏹️ **Đã tắt nhạc!**');
  } 
  // Lệnh xem danh sách phát: !q hoặc !queue
  else if (command === 'queue' || command === 'q') {
    const queue = distube.getQueue(message);
    if (!queue) return message.reply('❌ Hàng chờ đang trống!');
    const qList = queue.songs.slice(0, 10).map((s, i) => `${i === 0 ? '▶️' : `**${i}.**`} ${s.name} - \`${s.formattedDuration}\``).join('\n');
    const embed = new EmbedBuilder().setTitle('🎶 Danh sách phát').setDescription(qList).setColor('#5865F2');
    message.reply({ embeds: [embed] });
  }
});

// Thông báo khi bài hát bắt đầu vang lên
distube.on('playSong', (queue, song) => {
  queue.textChannel.send(`🎶 **Đang phát:** \`${song.name}\` - \`${song.formattedDuration}\` (Yêu cầu bởi: ${song.user})`);
});

client.login(process.env.DISCORD_TOKEN);
