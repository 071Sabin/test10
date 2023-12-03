var express = require('express');
// var router = express.Router();
const multer = require('multer');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const Tesseract = require('node-tesseract-ocr');
// const bcrypt = require('bcrypt'); //encyypt and decrypt
// const { v4: uuidv4 } = require('uuid'); //used to create random texts of 32 places.
const jsZip = require('jszip');
// var admin = require("firebase-admin");

const app=express();
app.use(cookieParser());

function generateUserId(){
  const userRandomId = Math.random().toString(36).substr(2, 9);
  return`user_${userRandomId}`;
}

// Middleware to check if user ID cookie is set, and if not, generate a new one
app.use((req, res, next) => {
  if (!req.cookies.userName) {
    const userId = generateUserId();
    res.cookie('userName', userId, { maxAge: 30 * 24 * 60 * 60 * 1000 }, { httpOnly: true, sameSite: 'strict' }); // Expires in 30 days:: { httpOnly: true, sameSite: 'strict' }
  }
  next();
});

// Define the storage configuration for multer
// each file upload goes through this process.
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    var userId = req.cookies.userName;
    // console.log("*******user name from cookie is===> ", userId);

    // creating a unique folder for every users.
    const folderName = `public/uploads/${userId}`;
    const imgFolder = path.join(folderName, 'images');

    if(!fs.existsSync(folderName)){
      fs.mkdirSync(folderName);
    }
    if(!fs.existsSync(imgFolder)){
      fs.mkdirSync(imgFolder);
    }
    cb(null, imgFolder); // Specify the destination folder where images should be stored
  },
  
  filename: function (req, file, cb) {
    const extension = path.extname(file.originalname);
    cb(null, Date.now() + extension); // Use the current timestamp as the filename to ensure uniqueness
  },
});


const fileFilter = (req, file, cb) => {

  // Check if the file type is an image
  if (file.mimetype.startsWith('image/')) {
    cb(null, true); // Accept the file
  } 
  // Reject the file with error message
  else {
    req.fileValidationError = "Oops, you didn't upload an image file :('";
    cb(null, false); 
  }
};

// Configure multer with the storage settings
const upload = multer({ storage: storage, fileFilter: fileFilter});

/* GET home page. */
app.get('/', function(req, res, next) {
  res.render('index', { title: 'Image To Text', errorMessage: null});
});

// write upload.array('input field name', maxcount)
app.post('/converted', upload.array('files'), function(req, res) {

  if (req.fileValidationError) {
    return res.render('index', { title: 'Image To Text', errorMessage: req.fileValidationError});
  }

  else{
    const inpvalue = req.body.language;
    const zip1 = new jsZip();
    const userId = req.cookies.userName;
    var zipFileName = `./public/uploads/${userId}/texts/imageToText.zip`;

    var textCount=0;
    var uploadCount = 0;

    var textFolder = path.join(`./public/uploads/${userId}`, 'texts');
    if(!fs.existsSync(textFolder)){
      fs.mkdirSync(textFolder);
    }

    let lng = "";


    if(inpvalue === '1'){
      lng='nep';
    }
    if(inpvalue == '2'){
      lng='eng';
    }

    req.files.forEach((file)=>{
      const imagePath = file.path;
      Tesseract.recognize(imagePath, {
        lang: lng,
        oem: 1,
        psm: 3,
      })

      .then((text)=>{

        // 1. seperating file name and extension. And removing the extension .jpg at last or whatever the extensions is.
        //    basically extracting name of the file.
        
        // const textFilePath1=(path.basename(imagePath).slice(0, -path.extname(imagePath).length));

        // file.originalname represents the filename as the user uploaded. we're removing extension and just getting basename from imagename.jpg
        const createTextFiles_withPath = path.join(textFolder, `${path.basename(file.originalname, path.extname(file.originalname))}.txt`);
        fs.writeFileSync(createTextFiles_withPath, text);

        // textCount increases till all the img files are converted to text.
        // uploadCount counts the no. of images uploaded
        // uploadCount wala line paila execute hunxa and then converts to text
        // so increase uploadCount and let the download appear after uploadCount == textCount
        textCount++;
        // console.log(textCount);

        // deletes all the images after converted to texts at once, so it's just 'unlink' else it would me unlinkSync.
        // promises checks if all the file related tasks are completed. it promises that after the file related tasks are completed then it will unlink the image files.
        fs.promises.unlink(imagePath);

        const textFilesContent = fs.readFileSync(createTextFiles_withPath); // creating zip files for each text files converted from images.
        zip1.file(path.basename(createTextFiles_withPath), textFilesContent);  // extracting just filename from texts folder & adding all the file contents to zip1 variable
      
        zip1.generateAsync({  type: "nodebuffer" }).then((content) => {
          // const zipFileName = `./public/uploads/${userId}/texts/imageToText.zip`;
  
          fs.writeFile(zipFileName, content, (err) => {
            if(err){
              return
            }
            fs.promises.unlink(createTextFiles_withPath);
            if(textCount == uploadCount){
              res.download(zipFileName);
            }
          });
        });
      });
      // uploadCount is here to count the number of img files uploaded. on the basis of this we compare the textCount and let the user to download the zip file.
      uploadCount++;
    });
  }
});

module.exports = app;