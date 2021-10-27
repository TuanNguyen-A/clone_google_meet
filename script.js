const vm = new Vue({
  el: "#app",
  data: {
    userToken: "",
    roomToken: "",
    roomId: "",
    roomData: undefined,
    room: undefined,
    client: undefined,
    trackList: [],
    video: true,
    mic: true,
  },
  computed: {
    roomUrl: function () {
      return `https://${location.hostname}?room=${this.roomId}`;
    },
    videoIcon: function () {
      if (this.video) return "fas fa-video";
      else return "fas fa-video-slash";
    },
    micIcon: function () {
      if (this.mic) return "fas fa-microphone";
      else return "fas fa-microphone-slash";
    },
  },
  mounted() {
    api.setRestToken();

    const urlParams = new URLSearchParams(location.search);
    const roomId = urlParams.get("room");

    if (roomId) {
      this.roomId = roomId;
      this.joinRoom();
    }
  },
  methods: {
    login: function () {
      return new Promise(async (resolve) => {
        const userId = (Math.random() * 10000).toFixed(0);
        const userToken = await api.getUserToken(userId);
        this.userToken = userToken;

        if (!this.client) {
          const client = new StringeeClient();

          client.on("authen", function (res) {
            console.log("on authen: ", res);
            resolve(res);
          });
          this.client = client;
        }
        this.client.connect(userToken);
      });
    },
    publishVideo: async function (shareScreen = false) {
      $("body").css("background-color", "#333");

      const localTrack = await StringeeVideo.createLocalVideoTrack(
        this.client,
        {
          audio: true,
          video: true,
          screen: shareScreen,
          videoDimensions: { width: 640, height: 360 },
        }
      );

      const videoElement = localTrack.attach();
      videoElement.setAttribute("class", "others");
      //videoElement.setAttribute('id','local')
      $("#videos").append(videoElement);

      this.trackList.push(localTrack);

      const roomData = await StringeeVideo.joinRoom(
        this.client,
        this.roomToken
      );
      const room = roomData.room;
      console.log({ roomData, room });

      if (!this.room) {
        this.roomData = roomData;
        this.room = room;
        this.room.clearAllOnMethos();
        this.room.on("addtrack", async (event) => {
          const trackInfo = event.info.track;
          console.log("add track");
          if (trackInfo.serverId === localTrack.serverId) {
            return;
          }
          this.subscribeTrack(trackInfo);
        });

        room.on("removetrack", (event) => {
          if (!event.track) {
            return;
          }

          const elements = event.track.detach();
          elements.forEach((element) => element.remove());
        });

        roomData.listTracksInfo.forEach((trackInfo) =>
          this.subscribeTrack(trackInfo)
        );
      }

      console.log("Local Track: ", localTrack);
      this.room
        .publish(localTrack)
        .then(function () {
          console.log(
            "publish Local Video Track success: " + localTrack.serverId
          );
        })
        .catch(function (error1) {
          console.log("publish Local Video Track ERROR: ", error1, localTrack);
        });
    },
    createRoom: async function () {
      const room = await api.createRoom();
      const roomToken = await api.getRoomToken(room.roomId);

      this.roomId = room.roomId;
      this.roomToken = roomToken;

      await this.login();
      await this.publishVideo();
    },
    joinRoom: async function (showPrompt = false) {
      if (showPrompt) {
        const roomId = prompt("Dán room ID vào đây");
        if (!roomId) {
          return;
        }
        this.roomId = roomId;
      }

      const roomToken = await api.getRoomToken(this.roomId);
      this.roomToken = roomToken;

      await this.login();
      await this.publishVideo();
    },
    subscribeTrack: async function (trackInfo) {
      const track = await this.room.subscribe(trackInfo.serverId);
      track.on("ready", () => {
        const ele = track.attach();
        this.addVideo(ele);
      });
    },
    addVideo: function (videoElement) {
      videoElement.setAttribute("controls", true);
      videoElement.setAttribute("playsinline", true);
      //set video
      videoElement.setAttribute("class", "others");
      $("#videos").append(videoElement);
    },
    changeVideo: async function () {
      console.log("changeVideo");
      if (this.video) {
        $("#btn-video").addClass("is-danger");
      } else {
        $("#btn-video").removeClass("is-danger");
      }
      this.video = !this.video;

      this.trackList.forEach(function (track) {
        if (track.screen) {
          return;
        }

        console.log(
          "hien tai track.localVideoEnabled=" + track.localVideoEnabled
        );

        if (track.localVideoEnabled) {
          //disable
          track.enableLocalVideo(false);
          $("#disableVideoBtn").html("Enable local video");
        } else {
          //enable
          track.enableLocalVideo(true);
          $("#disableVideoBtn").html("Disable local video");
        }
      });
    },
    changeMic: async function () {
      console.log("changeMic");
      if (this.mic) {
        $("#btn-mic").addClass("is-danger");
      } else {
        $("#btn-mic").removeClass("is-danger");
      }
      this.mic = !this.mic;

      this.trackList.forEach(function (track) {
        if (track.muted) {
          //unmute
          console.log("unmute");
          track.mute(false);
        } else {
          //mute
          console.log("mute");
          track.mute(true);
        }
      });
    },
  },
});
