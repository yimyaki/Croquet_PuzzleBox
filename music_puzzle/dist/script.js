const PieceSize = 100;
const PieceDiameter = PieceSize/2;
let audioContext = null;

class PuzzleBoxModel extends Croquet.Model {
    init(options) {
        super.init(options);
        this.width = 720;
        this.height = 720;
        //this.wrapTime = 0;
        this.pieces = new Map();
        this.currentId = 0;
        
        const pic_source = "https://s3-us-west-2.amazonaws.com/s.cdpn.io/29841/dog.jpg";
        this.pic_url = `url(${pic_source})`
        console.log(this.pic_width);
        this.children = [];
        this.pic_width = 604;
        this.pic_height = 400;

        //this.future(2000).wrap();
        this.subscribe(this.id, "grab", this.grab);
        this.subscribe(this.id, "move", this.move);
        this.subscribe(this.id, "release", this.release);
        this.subscribe(this.sessionId, "view-exit", this.deleteUser);
        this.subscribe(this.id, "reload", this.initialize);
        this.subscribe("global", "add-asset", this.addAsset);
        this.initialize([this.pic_width,this.pic_height, this.pic_url]);
    }
  
    initialize(metadata){
      console.log('init');
      this.pic_width = metadata[0];
      this.pic_height = metadata[1];
      this.pic_url = metadata[2];
      const r = max => Math.floor(max * this.random());
      this.children = [];
      console.log(metadata);
      for (let i = 0; i < Math.floor(this.pic_width/PieceSize); i++){
          for(let j = 0; j <Math.floor(this.pic_height/PieceSize); j++){
             this.children.push({pos:[r(300), r(300)], goal: [PieceSize*i,PieceSize*j], backPos : (this.pic_width-PieceSize*i)+'px '+ (this.pic_height -PieceSize*j)+'px'});
          }
        }

        //console.log("new_del?");
        this.pieces = new Map();

        console.log('adding pieces', this.children);

        this.children.forEach(obj => {
            this.pieces.set(this.currentId++, {
                x: obj.pos[0],
                y: obj.pos[1],
                grabbed: null,
                goal: obj.goal,
                backPos: obj.backPos,
                initPos:obj.pos,
            });
        });
      //console.log('init1')
      this.publish(this.id, "reloaded");
    }

    deleteUser(viewId) {
        this.pieces.forEach(value => {
            if (value.grabbed === viewId) {
                value.grabbed = null;
            }
        });
    }
  
    addAsset(asset) {
        this.asset = asset;
        this.publish("global", "asset-added", asset);
    }
  
    removePiece(data) {
        const {viewId, id} = data;
        const piece = this.pieces.get(id);
        if (!piece) {return;}
        if (piece.grabbed !== viewId) {return;}
        this.pieces.delete(id);
        console.log("deleted");

        this.publish(this.id, "removed", {viewId, id});
    }

    grab(data) {
        console.log('m-grab');
        const {viewId, id} = data;
        const piece = this.pieces.get(id);
        if (!piece) {return;}
        if (piece.grabbed) {return;}
        piece.grabbed = viewId;
        this.publish(this.id, "grabbed", data);
    }

    move(data) {
        const {viewId, id, x, y} = data;
        const piece = this.pieces.get(id);
        if (!piece) {return;}
        if (piece.grabbed !== viewId) {return;}
        piece.x = x;
        piece.y = y;
        this.publish(this.id, "moved", data);
    }

    release(data) {
        const {viewId, id} = data;
        const piece = this.pieces.get(id);
        if (!piece) {return;}
        if (piece.grabbed !== viewId) {return;}
        piece.grabbed = null;
        piece.x = Math.min(piece.x, this.width - PieceDiameter);
        this.publish(this.id, "released", data);
    }
  /*
    wrap() {
        this.wrapTime = this.now() / 1000.0;
        this.future(2000).wrap();
        this.publish(this.id, "wrap", this.wrapTime);
    }*/
}

PuzzleBoxModel.register("PuzzleBoxModel");

class PuzzleBoxView extends Croquet.View {
    constructor(model) {
        super(model);
        this.model = model;
        //this.wrapTime = 0;
        //this.lastWrapTime = this.wrapTime;
        //this.lastWrapRealTime = Date.now();
        this.pic_width  = model.pic_width;
        this.pic_height = model.pic_height;
        this.pic_url = model.pic_url;//"url(https://s3-us-west-2.amazonaws.com/s.cdpn.io/29841/dog.jpg)";

        this.grabInfo = new Map();
        this.viewPieces = new Map(model.pieces);
        this.pieces = null; // will be a Map() <id, dom>
        this.is_init = 0;

        //this.subscribe(this.model.id, "wrap", time => this.wrapTime = time);
        this.subscribe(this.model.id, "grabbed", data => this.grabPiece(data));
        this.subscribe(this.model.id, "moved", data => this.movePiece(data));
        this.subscribe(this.model.id, "released", data => this.releasePiece(data));
        this.subscribe(this.model.id, "removed", data => this.removePiece(data));
        this.subscribe("global", "asset-added", this.assetAdded);
        this.subscribe(this.model.id, "reloaded", this.reinitializePieces);
        if (model.asset) this.assetAdded(model.asset);

        window.ondragover = event => event.preventDefault();
        window.ondrop = event => {
            event.preventDefault();
            this.addFile(event.dataTransfer.items[0].getAsFile());
        }
        imageinput.onchange = () => {
            this.addFile(imageinput.files[0]);
            imageinput.value = '';
          };

        this.field = window.document.querySelector("#field");
        //this.field.style.height = this.model.height;
        //this.bar = window.document.querySelector("#bar");
        this.addContainer = window.document.querySelector("#addContainer");

        this.addContainer.addEventListener("click", () => this.reset());
        this.field.addEventListener("pointerdown", evt => this.pointerDown(evt));
        this.field.addEventListener("pointermove", evt => this.pointerMove(evt));
        this.field.addEventListener("pointerup", evt => this.pointerUp(evt));
        console.log('new_init');

        this.initializePieces();
        window.view = this;
    }

    initializePieces() {
        console.log('into_init..');
        console.log(this.viewPieces);
        this.pieces = new Map();
        this.field.removeAllChildNodes();
        for (const id of this.viewPieces.keys()) {
            console.log('create');
            this.newPiece(id);
        }
        this.is_init = 1;
    }
    reinitializePieces(){
      //const info = this.grabInfo.get(pointerId);
      console.log('init_view')
      if(this.is_init > 0){
        this.pieces = new Map();
        for (const id of this.viewPieces.keys()) {
            this.newPiece(id);
            //this.updatePiece(id);
        }
      }
    }
    reset(){
      //this.viewBalls.forEach(b => {console.log(b.initPos[0]);});//{b.x = b.initPos[0]; b.y = b.initPos[1]; this.updateBall(b.id);});
      this.publish(this.model.id, "reload", [this.pic_width,this.pic_height]);
    }

    newPiece(id) {
        //console.log("np1");
        const piece = document.createElement("div");
        piece.classList.add("piece");
        this.pieces.set(id, piece);
        this.field.appendChild(piece);
        this.updatePiece(id);
    }

    grabPiece(data, viewSide) {
        console.log('grab')
        const {viewId, id} = data;
        if (!viewSide && viewId === this.viewId) {return;}
        const piece = this.viewPieces.get(id);
        this.viewPieces.set(id, {...piece, grabbed: viewId});
        this.updatePiece(id);
    }

    movePiece(data, viewSide) {
        console.log('move');
        const {viewId, id, x, y} = data;
        if (!viewSide && viewId === this.viewId) {return;}
        this.viewPieces.set(id, {x, y, grabbed: viewId});
        this.updatePiece(id);
    }

    releasePiece(data, viewSide) {
        console.log('release');
        const {viewId, id} = data;
        if (viewSide && viewId === this.viewId) {return;}
        const piece = this.viewPieces.get(id);
        if (piece) {
            this.viewPieces.set(id, {...piece, grabbed: null});
            this.updatePiece(id);
        }
    }
  
    async addFile(file) {
        if (!file.type.startsWith('image/')) return this.showMessage(`Not an image: "${file.name}" (${file.type})`);
        this.showMessage(`reading "${file.name}" (${file.type})`);
        const data = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsArrayBuffer(file);
        });
        this.showMessage(`sending "${file.name}" (${data.byteLength} bytes}`);
        const handle = await Croquet.Data.store(this.sessionId, data); // <== Croquet.Data API
        const asset = { name: file.name, type: file.type, size: data.byteLength, handle };
        this.publish("global", "add-asset", asset);
    }

    // every user gets this event via model
    async assetAdded(asset) {
        this.showMessage(`fetching "${asset.name}" (${asset.size} bytes}`);
        this.showImage(asset);
    }

    showMessage(string) {
        message.innerText = string;
        console.log(string);
    }
  
    async showImage(asset) {
        const data = await Croquet.Data.fetch(this.sessionId, asset.handle);  // <== Croquet.Data API
        this.showMessage(`fetched "${asset.name}" (${data.byteLength} bytes)`);
        const blob = new Blob([data], { type: asset.type });
        const new_url = URL.createObjectURL(blob);
        this.pic_url = `url(${new_url})`;
        await this.getMeta(new_url);
        console.log('ok');
        this.publish(this.model.id, "reload", [this.pic_width,this.pic_height,this.pic_url]);
        console.log('maybe?');
        //this.initializePieces();
    }
  
    async getMeta(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.pic_width = img.width;
                this.pic_height = img.height;
                resolve();
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    removePiece(data) {
        const {id} = data;
        console.log(id);
        this.viewPieces.delete(id);
        const piece = this.pieces.get(id);
        if (piece) {
            piece.remove();
            piece.pieces.delete(id);
        }
    }

    findPiece(x, y, pieces) {
        const entries = Array.from(pieces.entries());
        for (let i = entries.length - 1; i >= 0; i--) {
            const entry = entries[i];
            const diffX = (entry[1].x + PieceDiameter) - x;
            const diffY = (entry[1].y + PieceDiameter) - y;
            if ((diffX * diffX + diffY * diffY) <= PieceDiameter ** 2) {
                return entry;
            }
        }
        return null;
    }

    updatePiece(id) {
        //console.log("update1")
        const pieceData = this.viewPieces.get(id);
        if (!pieceData) {return;}

        const piece = this.pieces.get(id);
        if (!piece) {return;}

        const border = !pieceData.grabbed ? "" : (pieceData.grabbed === this.viewId ? "1px solid red" : "1px solid black");
        const transform = `translate(${pieceData.x}px, ${pieceData.y}px)`;
      
        piece.style.backgroundImage = this.pic_url;
        piece.style.backgroundPosition= pieceData.backPos;

        piece.style.setProperty("border", border);
        piece.style.setProperty("transform", transform);
        //console.log(ballData);
    }

    pointerDown(evt) {
        console.log('click');
        const x = evt.offsetX;
        const y = evt.offsetY;
        const pointerId = evt.pointerId;
        const pieces = this.model.pieces;
        const entry = this.findPiece(x, y, pieces);
        if (!entry) {return;}
        const [pieceId, pieceData] = entry;
        if (pieceData.grabbed && pieceData.grabbed !== this.viewId) {return;}
        const info = this.grabInfo.get(pointerId);
        if (info) {return;}
        const g = {pieceId: entry[0], grabPoint: {x, y}, translation: {x: pieceData.x, y: pieceData.y}};

        this.grabInfo.set(evt.pointerId, g);
        this.viewPieces.get(pieceId).grabbed = this.viewId;
        this.publish(this.model.id, "grab", {viewId: this.viewId, id: pieceId});
        this.updatePiece(pieceId);
        evt.target.setPointerCapture(evt.pointerId);
    }

    pointerMove(evt) {
        if (evt.buttons === 0) {return;}
        const pointerId = evt.pointerId;
        const info = this.grabInfo.get(pointerId);
        if (!info) {return;}

        const piece = this.model.pieces.get(info.pieceId);
        if (!piece) {return;}
        if (piece.grabbed && piece.grabbed !== this.viewId) {return;}
        let x = evt.offsetX - info.grabPoint.x + info.translation.x;
        let y = evt.offsetY - info.grabPoint.y + info.translation.y;
        if((Math.abs(piece.x-piece.goal[0])<10)&&(Math.abs(piece.y-piece.goal[1])<10)){
          x = piece.goal[0];
          y = piece.goal[1];}
        if (x <= 0) {x = 0;}
        if (x > this.model.width - PieceDiameter * 2) {x = this.model.width - PieceDiameter * 2;}
        if (y <= 0) {y = 0;}
        if (y > this.model.height - PieceDiameter * 2) {y = this.model.height - PieceDiameter * 2;}
        this.viewPieces.set(info.pieceId, {x, y, grabbed: info.grabbed});
        this.publish(this.model.id, "move", {viewId: this.viewId, id: info.pieceId, x, y});
        this.updatePiece(info.pieceId);
    }

    pointerUp(evt) {
        const pointerId = evt.pointerId;
        evt.target.releasePointerCapture(pointerId);
        const info = this.grabInfo.get(pointerId);
        if (!info) {return;}

        this.grabInfo.delete(evt.pointerId);
        if (this.viewPieces.get(info.pieceId)) {
            this.viewPieces.get(info.pieceId).grabbed = null;
        }

        const pieceData = this.viewPieces.get(info.pieceId);
        if (!pieceData) {return;}
        if (pieceData.x > this.model.width) {
            
        }
        this.publish(this.model.id, "release", {viewId: this.viewId, id: info.pieceId});
        this.updatePiece(info.pieceId);
    }

    update(_time) {
        const updateNow = Date.now();
        //const toPlay = [];

        /*if (this.lastWrapTime !== this.wrapTime) {
            this.lastWrapTime = this.wrapTime;
            const now = Date.now();
            this.lastWrapRealTime = now;
        }*/

        const scale = Math.min(1, window.innerWidth / this.model.width, window.innerHeight / this.model.height);

        this.field.style.transform = `scale(${scale})`;
        this.field.style.width = `${this.model.width}px`;
        this.field.style.height = `${this.model.height}px`;
    }
}

Croquet.Session.join({
  apiKey: "1b4OttyaBANk8uENpoL2t4CIAmB3al2z013rFpbg7",
  appId: "io.croquet.yashaswini.makaram.awesome-app",
  /* (more join options)... */
  name: Croquet.App.autoSession(),
  password: Croquet.App.autoPassword(),
  model: PuzzleBoxModel,
  view: PuzzleBoxView,
    eventRateLimit: 60,
    tps: 10
});/*.then(context => {
    window.session = context;
});*/