import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const app = express();

app.use(cors());

mongoose.connect('mongodb+srv://cookbook:jTyTfD8uLHxpvqD@cluster0.8ekwc6d.mongodb.net/myFirstDatabase?retryWrites=true&w=majority', {
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Error connecting to MongoDB:', err));

const bookSchema = new mongoose.Schema({
    title: String,
    tableOfContents: String,
    imagePath: String 
});

const pageSchema = new mongoose.Schema({
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
    bookTitle: String,
    pageId: String,
    recipeStory: String,
    ingredients: [
        {
            name: String,
            quantity: Number,
            unit: String
        }
    ],
    steps: [String]
});

const Book = mongoose.model('Book', bookSchema);
const Page = mongoose.model('Page', pageSchema);

app.use(bodyParser.json());



const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../cookbook-ui/src/uploads')); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

app.post('/api/books', upload.single('image'), async (req, res) => {
    try {
        const { title, tableOfContents, imagePath } = req.body;
        const newBook = new Book({ title, tableOfContents, imagePath });
        await newBook.save();
        res.status(201).json({ message: 'Book created successfully', book: newBook });
    } catch (err) {
        console.error('Error creating book:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/pages', async (req, res) => {
    try {
        const { bookId, bookTitle, pageId, recipeStory, ingredients, steps } = req.body;
        let page = await Page.findOneAndUpdate(
            { pageId },
            { bookId, bookTitle, pageId, recipeStory, ingredients, steps },
            { upsert: true, new: true }
        );
        res.status(201).json({ message: 'Page created/updated successfully', page });
    } catch (err) {
        console.error('Error creating/updating page:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/books', async (req, res) => {
    try {
        const books = await Book.find();
        res.status(200).json(books);
    } catch (err) {
        console.error('Error fetching books:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/books/:title', async (req, res) => {
    try {
        const book = await Book.findOne({ title: req.params.title });
        if (book) {
            res.status(200).json(book);
        } else {
            res.status(404).json({ message: 'Book not found' });
        }
    } catch (err) {
        console.error('Error fetching book:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.put('/api/books/:title', async (req, res) => {
    try {
        const { title } = req.params;
        const { tableOfContents } = req.body;
        let book = await Book.findOneAndUpdate(
            { title },
            { tableOfContents },
            { new: true }
        );
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        res.status(200).json({ message: 'Book updated successfully', book });
    } catch (err) {
        console.error('Error updating book:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.put('/api/pages/:pageId', async (req, res) => {
    try {
        const { recipeStory, ingredients, steps } = req.body;
        const { pageId } = req.params;
        let page = await Page.findOneAndUpdate(
            { pageId },
            { recipeStory, ingredients, steps },
            { new: true }
        );
        res.status(200).json({ message: 'Page updated successfully', page });
    } catch (err) {
        console.error('Error updating page:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/pages/:pageId', async (req, res) => {
    try {
        const { pageId } = req.params;
        const page = await Page.findOne({ pageId: pageId });
        if (page) {
            const { recipeStory, ingredients, steps } = page;
            res.status(200).json({ recipeStory, ingredients, steps });
        } else {
            res.status(404).json({ message: 'Page not found' });
        }
    } catch (err) {
        console.error('Error fetching page:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.delete('/api/books/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const book = await Book.findById(id);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        await Page.deleteMany({ bookId: id });

        await Book.deleteOne({ _id: id });

        res.status(200).json({ message: 'Book and associated pages deleted successfully' });
    } catch (err) {
        console.error('Error deleting book and associated pages:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.delete('/api/pages/:pageId', async (req, res) => {
    try {
        const { pageId } = req.params;
        const deletedPage = await Page.findByIdAndDelete(pageId);
        if (!deletedPage) {
            return res.status(404).json({ message: 'Page not found' });
        }
        const book = await Book.findById(deletedPage.bookId);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        const updatedTableOfContents = book.tableOfContents.filter(content => content !== deletedPage.pageId);
        book.tableOfContents = updatedTableOfContents.join('\n');
        await book.save();
        res.status(200).json({ message: 'Page deleted successfully', deletedPage });
    } catch (err) {
        console.error('Error deleting page:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.use('/uploads', express.static(path.join(__dirname, '../cookbook-ui/src/uploads')));

if (process.env.NODE_ENV === 'production') {
    app.use(express.static('bookshelf-app/build'));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'bookshelf-app', 'build', 'index.html'));
    });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


export default app;