import mongoose from "mongoose";

export const connetDB =()=>{

 mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log("Server is connected to the database successfully..");
}).catch((e) => {
    console.log("DataBase connection error", e);
})
}