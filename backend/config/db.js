import mongoose from "mongoose";

export const connectDB = async () => {
    await mongoose.connect('mongodb+srv://siyajifriya7034_db_user:9se4xximfDRCP3kU@cluster0.kseqiye.mongodb.net/carRental')
    .then(() => console.log('DB Connected'));
    
}