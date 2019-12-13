"use strict";
/* exported Scene */

// uses https://github.com/ricmoo/aes-js
class Scene extends UniformProvider {
  constructor(gl) {
    super("scene");

    this.timeAtFirstFrame = new Date().getTime();
    this.timeAtLastFrame = this.timeAtFirstFrame;

    this.triangleGeometry = new TriangleGeometry(gl);
    this.quadGeometry = new QuadGeometry(gl);

    this.vsIdle = new Shader(gl, gl.VERTEX_SHADER, "idle-vs.glsl");
    this.fsSolid = new Shader(gl, gl.FRAGMENT_SHADER, "solid-fs.glsl");
    this.fsStriped = new Shader(gl, gl.FRAGMENT_SHADER, "striped-fs.glsl");    

    this.programs = [];
    this.programs.push( this.solidProgram = new Program(gl, this.vsIdle, this.fsSolid));
    this.programs.push( this.stripedProgram = new Program(gl, this.vsIdle, this.fsStriped));    
    
    this.camera = new OrthoCamera(...this.programs);

    this.cryptoMaterial = new Material(gl, this.solidProgram);
    this.cryptoMaterial.solidColor.set(0.0, 1.0, 0.8);
    this.cryptoQuad = new Mesh(this.cryptoMaterial, this.quadGeometry);

    this.gameObjects = [];
    this.selectedObjects = [];

    this.createPenguin();

    this.numQuad = 0;
    this.encryptedTexts = [];

    this.createEncryptedECBBlocks();

    this.rows = [];
    this.offset = 0;
    this.objI = 0;
    this.createECBVisualization(gl);

    this.encryptedCBCTexts = [];
    this.createEncryptedCBCBlocks();

    this.offset = 0;
    this.createCBCVisualization(gl);

    this.selectedRow = 0;

    this.addComponentsAndGatherUniforms(...this.programs);
  }

  resize(gl, canvas) {
    gl.viewport(0, 0, canvas.width, canvas.height);

    this.camera.setAspectRatio(canvas.width / canvas.height);
  }

  update(gl, keysPressed, keysPressedDown, mouse) {
    //jshint bitwise:false
    //jshint unused:false
    const timeAtThisFrame = new Date().getTime();
    const dt = (timeAtThisFrame - this.timeAtLastFrame) / 1000.0;
    const t = (timeAtThisFrame - this.timeAtFirstFrame) / 1000.0; 
    this.timeAtLastFrame = timeAtThisFrame;

    // move selected objects
    if(keysPressed.LEFT){
      for (const selectedObject of this.rows[this.selectedRow]) {
        selectedObject.position.x += -0.01;
      }
    }
    if(keysPressed.RIGHT){
      for (const selectedObject of this.rows[this.selectedRow]) {
        selectedObject.position.x += 0.01;
      }
    }    
    if(keysPressed.UP){
      if (keysPressedDown.UP) {
        keysPressedDown.UP = false;
        if (this.selectedRow > 0) {
          this.selectedRow--;
        } else {
          this.selectedRow = this.rows.length - 1;
        }
      }
    }        
    if(keysPressed.DOWN){
      if (keysPressedDown.DOWN) {
        keysPressedDown.DOWN = false;
        if (this.selectedRow < this.rows.length - 1) {
          this.selectedRow++;
        } else {
          this.selectedRow = 0;
        }
      }
    }

    // change selected objects' orientations
    if (keysPressed.A) {
      for (const selectedObject of this.selectedObjects) {
        selectedObject.orientation += 0.1;
      }
    }
    if (keysPressed.D) {
      for (const selectedObject of this.selectedObjects) {
        selectedObject.orientation -= 0.1;
      }
    }

    // scroll left
    if (keysPressed.J) {
      this.camera.position = this.camera.position.minus(0.1);
      this.camera.update();
    }

    // scroll right
    if (keysPressed.L) {
      this.camera.position = this.camera.position.plus(0.1);
      this.camera.update();
    }

    // scroll up
    if (keysPressed.I) {
      this.camera.position = this.camera.position.plus(new Vec2(0.0, 0.1));
      this.camera.update();
    }

    // scroll down
    if (keysPressed.K) {
      this.camera.position = this.camera.position.plus(new Vec2(0.0, -0.1));
      this.camera.update();
    }

    // clear the screen
    gl.clearColor(0.3, 0.0, 0.3, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (const gameObject of this.gameObjects) {
      gameObject.update();
      gameObject.draw(this.camera);
    }
  }

  createGameObjects(shape1, shape2) {
    for (let i = 0; i < 4; i++) {
      this.gameObjects.push(new GameObject(shape1));
      this.gameObjects[i].scale = new Vec3(0.2, 0.2, 1);
      this.gameObjects[i].position.x = (i - 1) / 2 - 0.25;
      this.gameObjects[i].position.y = 0.5;
    }

    for (let i = 0; i < 4; i++) {
      this.gameObjects.push(new GameObject(shape2));
      this.gameObjects[i + 4].scale = new Vec3(0.2, 0.2, 1);
      this.gameObjects[i + 4].position.x = (i - 1) / 2 - 0.25;
      this.gameObjects[i + 4].position.y = -0.5;
    }
  }

  // r = red
  // g = green
  // b = blue
  // i = index of object in gameObjects array
  // gl = gl object
  // rowlen = length of the row
  // j = index in row
  // yoff = y offset
  // rad = width/height of a block
  createHexObjectRadius(r, g, b, i, gl, rowlen, j, yoff, rad) {
    let myCryptoMaterial = new Material(gl, this.solidProgram);
    myCryptoMaterial.solidColor.set(r, g, b);
    let myCryptoQuad = new Mesh(myCryptoMaterial, this.quadGeometry);
    this.gameObjects.push(new GameObject(myCryptoQuad));
    const width = rad;
    this.gameObjects[i].scale = new Vec3(width, width, 1);
    this.gameObjects[i].position.x = j * width + -1.0 + rowlen;
    this.gameObjects[i].position.y = 0.5 - yoff;
    return this.gameObjects[i];
  }

  getColorFromBlock(str) {
    // str is a 2-character string of hex
    return parseInt(str, 16) / 255.0;
  }

  getPaddedText(text) {
    let mod = text.length % 16;
    if (mod != 0) {
      for (let i = 0; i < 16 - mod; i++) {
        text = text + "0";
      }
    }
    return text;
  }

  encryptBlocksECB(text) {
    text = this.getPaddedText(text);
    let encryptedText = "";
    for(let i = 0; i < text.length; i += 16) {
      encryptedText += this.encryptTextECB(text.substring(i, i + 16)).substring(0, 15);
    }
    return encryptedText;
  }

  encryptTextECB(text) {
    // An example 128-bit key
    let key = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ];

    let textBytes = aesjs.utils.utf8.toBytes(text);

    let aesEcb = new aesjs.ModeOfOperation.ecb(key);
    let encryptedBytes = aesEcb.encrypt(textBytes);

    let encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
    return encryptedHex;
  }

  createEncryptedECBBlocks() {
    for(const text of this.texts) {
      this.encryptedTexts.push(this.encryptBlocksECB(text));
    }
  }

  createECBVisualization(gl) {
    for(const text of this.encryptedTexts) {
      this.rows.push(this.createVisualizationGrayscale(text, gl, this.objI, 0, this.offset));
      this.objI++;
      this.offset += 0.02;
    }
  }

  encryptBlocksCBC(text) {
    text = this.getPaddedText(text);
    let encryptedText = "";
    for(let i = 0; i < text.length; i += 16) {
      encryptedText += this.encryptTextCBC(text.substring(i, i + 16)).substring(0, 15);
    }
    return encryptedText;
  }

  encryptTextCBC(text) {
    let key = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ];

    let iv = [];
    for(let i = 0; i < 16; i++) {
      iv.push(Math.floor(Math.random() * 100));
    }

    let textBytes = aesjs.utils.utf8.toBytes(text);

    let aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
    let encryptedBytes = aesCbc.encrypt(textBytes);

    var encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
    return encryptedHex;
  }

  createEncryptedCBCBlocks() {
    for(const text of this.texts) {
      this.encryptedCBCTexts.push(this.encryptBlocksCBC(text));
    }
  }

  createCBCVisualization(gl) {
    for(const text of this.encryptedCBCTexts) {
      this.rows.push(this.createVisualizationGrayscale(text, gl, this.objI, 1.0, this.offset));
      this.objI++;
      this.offset += 0.02;
    }
  }

  createVisualization(text, gl, row, rowlen, yoff) {
    let myRow = [];
    for(let i = 0; i < text.length; i+=6) {
      if (i + 6 <= text.length) {
        let r = this.getColorFromBlock(text.substring(i, i + 2));
        let g = this.getColorFromBlock(text.substring(i + 2, i + 4));
        let b = this.getColorFromBlock(text.substring(i + 4, i + 6));
        myRow.push(this.createHexObjectRadius(r, g, b, this.numQuad, gl, rowlen, i/3, yoff, 0.02));
        this.numQuad++;
      }
    }
    return myRow;
  }

  createVisualizationGrayscale(text, gl, row, rowlen, yoff) {
    let myRow = [];
    for(let i = 0; i < text.length; i+=2) {
      if (i + 2 <= text.length) {
        let r = this.getColorFromBlock(text.substring(i, i + 2));
        let g = this.getColorFromBlock(text.substring(i, i + 2));
        let b = this.getColorFromBlock(text.substring(i, i + 2));
        myRow.push(this.createHexObjectRadius(r, g, b, this.numQuad, gl, rowlen, i, yoff, 0.01));
        this.numQuad++;
      }
    }
    return myRow;
  }

  createPenguin() {
    this.text1 = '                                                                                               ';
    this.text2 = '                                                                                               ';
    this.text3 = '                                                                                               ';
    this.text4 = '                                                                                               ';
    this.text5 = '                                                                                               ';
    this.text6 = '                                      ,/##%%#(*                                                ';
    this.text7 = '                                   (@@@@@@@@@@@@@&/                                            ';
    this.text8 = '                                 (@@@@@@@@@@@@@&%&@@&,                                         ';
    this.text9 = '                                %@@@@@@@@@@@@@@%(#&@@@(                                        ';
    this.text10= '                               (@@@@@@@@@@@@@@@@@@@@@@@#                                       ';
    this.text11= '                              .&@@@@@@@@@@@@@@@@@@@@@@@@/                                      ';
    this.text12= '                              ,@@@@@@&@@@@@@@@@@&&@@@@@@%                                      ';
    this.text13= '                              ,@@%*,,(@@@@@#*,..,%@@@@@@&.                                     ';
    this.text14= '                              ,@&./%/ *@@@%. (@#. #@@@@@@,                                     ';
    this.text15= '                              .&%,@@%(*@@&&,*@@@% /@@@@@@,                                     ';
    this.text16= '                               &@,/@&(*,**/**%@&, #@@@@@@*                                     ';
    this.text17= '                               &@&*/***,,,,..,,,*/@@@@@@@(                                     ';
    this.text18= '                               #&(/**,,,,,..,,,*/*#@@@@@@&                                     ';
    this.text19= '                               (@%(*,,,,,,,,*//**/%@@&&@@@#                                    ';
    this.text20= '                               (@&/((//////////*,,(@@@#(#@@/                                   ';
    this.text21= '                              .&@%,,*((///((/*,,. .#@@@&@@@@(                                  ';
    this.text22= '                             ,@@@* .,,,,,,,,,,.     #@@@@@@@@#                                 ';
    this.text23= '                            (@@&,   .,,,,,..         (@@@@@@@@&.                               ';
    this.text24= '                          ,@@@&.                      %@@@@@@@@@/                              ';
    this.text25= '                        ,&@@@%.                       *@@@@@@@@@@@(                            ';
    this.text26= '                       ,@@@@@(*,.     ..       ...,,,,.(@@@@@@@@@@@@,                          ';
    this.text27= '                      ,@@@@@&*.                    ..,,.,&@@&&@@@@@@@,                         ';
    this.text28= '                      #@&@@%.                          .,.%@@@@&@@@@@&.                        ';
    this.text29= '                     *@@@@%.                              .&@%&&&@@@@@%                        ';
    this.text30= '                    .&@&@%                                 /@@@@@&@@@@@.                       ';
    this.text31= '                    %@&@&.                                 .&@@@@&@@@@@(                       ';
    this.text32= '                   %@@@@*                                   %@@@@&@@@@@&.                      ';
    this.text33= '                 .&@@&@@.           .                       #@@@@&@@@@@@*                      ';
    this.text34= '                .&@@@%&@            .                       #@@@@@@@@@@@*                      ';
    this.text35= '                *@@@@&&&            .                       #@@@&@@@@@@@*                      ';
    this.text36= '                .&%(#&@%            .                      .&@@@@@@@&%@&.                      ';
    this.text37= '                ***,,,,(@#.         .                   ,,,,#@@@@@@@@&@*                       ';
    this.text38= '         ..,,,,/**,,,,,,(@@&*                          .*,,*%@@@@@@@@@/,,.                     ';
    this.text39= '        ********,,,,,,,,,*&@@@(.                      ,,****(%@@@@@/*,*.                       ';
    this.text40= '       ./*,,,,,,,,,,,,,,,,*%@@@@&*                   .,,*****///////*,,,,,.                    ';
    this.text41= '        ***,,,,,,,,,,,,,,,,*#@@@@@/                  .,,/***********,,,,,,*,                   ';
    this.text42= '        ***,,,,,,,,,,,,,,,,,,(@@@@*                   /%/**,,,,,,,,,,,,,,,,,,,.                ';
    this.text43= '        ***,,,,,,,,,,,,,,,,,,,//                   .(@@%(**,,,,,,,,,,,,,,,,,,,,,               ';
    this.text44= '       ./**,,,,,,,,,,,,,,,,,,,,*/.              ./&@@@@%(**,,,,,,,,,,,,,,,,,***.               ';
    this.text45= '       /**,,,,,,,,,,,,,,,,,,,,**/%%/,.     .,/#@@@@@@@@%(**,,,,,,,,,,,,,****.                  ';
    this.text46= '      .///*******,,,,,,,,,,,,,**(#&@@@@@@@@@@@@@@@@@@@(/*,,,,,,,,****/,                        ';
    this.text47= '        .,*/(((/////****,,,,**/((#&@@@@@@@@@@@@@@@@@@@&%(//**,,****//*.                        ';
    this.text48= '                ,*/(##((/////((#%%%*                 .*%#((//////((*                           ';
    this.text49= '                        *(#%%%#(.                       ,#%%####/.                             ';
    this.text50= '                                                                                               ';
    this.text51= '                                                                                               ';
    this.text52= '                                                                                               ';

    this.texts = [this.text1, this.text2, this.text3, this.text4, this.text5, this.text6, this.text7, this.text8,
                  this.text9, this.text10, this.text11, this.text12, this.text13, this.text14, this.text15, this.text16,
                  this.text17, this.text18, this.text19, this.text20, this.text21, this.text22, this.text23, this.text24,
                  this.text25, this.text26, this.text27, this.text28, this.text29, this.text30, this.text31, this.text32,
                  this.text33, this.text34, this.text35, this.text36, this.text37, this.text38, this.text39, this.text40,
                  this.text41, this.text42, this.text43, this.text44, this.text45, this.text46, this.text47, this.text48,
                  this.text49, this.text50, this.text51, this.text52];
  }
}
