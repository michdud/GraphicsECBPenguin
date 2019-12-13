# GraphicsECBPenguin
Project for graphics class at AIT-Budapest

# About
This is a simple visualization of the weakness of the ECB mode of encryption. The left block of "pixels" depicts an (ASCII art) image of Tux, the Linux penguin, encrypted using ECB. The right block depicts the same image encrypted with CBC.

It uses GLSL, JavaScript, and [AES-JS](https://github.com/ricmoo/aes-js) as well as the [WebGLMath](https://github.com/szecsi/WebGLMath) library created by Prof. László Szécsi. Much of the code (aside from Scene.js) is from Prof. Szécsi's existing JavaScript reflection codebase.

To run:
1. Download AES-JS and place it inside the directory.
2. Download WebGLMath and place it outside of the directory.
3. Open index.html in Chrome, or another browser that supports WebGL.
