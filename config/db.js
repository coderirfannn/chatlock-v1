import mongoose from "mongoose";

export const connetDB =()=>{

 mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log("Server is connected to the database successfully..");
}).catch((e) => {
    console.log("DataBase connection error", e);
})
}

// mongodb+srv://mohdirfan70097:7XIlTvcvae8Olt21@cluster0.wneusop.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0