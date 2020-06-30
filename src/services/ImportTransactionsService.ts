import parseCSV from 'csv-parse/lib/sync';
import { getCustomRepository, getRepository, In } from 'typeorm';

import TransactionsRepository from '../repositories/TransactionsRepository';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface Request {
  fileBuffer: Buffer;
}

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute({ fileBuffer }: Request): Promise<Transaction[]> {
    const transactionsRespository = getCustomRepository(TransactionsRepository);
    const categoryRepository = getRepository(Category);

    const categories: string[] = [];

    const transactions: CSVTransaction[] = parseCSV(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    transactions.forEach(transaction => {
      categories.push(transaction.category);
    });

    const existentCategories = await categoryRepository.find({
      where: {
        title: In(categories),
      },
    });

    const existentCategoriesTitles = existentCategories.map(
      category => category.title,
    );

    const categoriesToAdd = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((category, index, self) => self.indexOf(category) === index);

    const newCategories = categoryRepository.create(
      categoriesToAdd.map(title => ({
        title,
      })),
    );

    await categoryRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories];

    const createdTransactions = transactionsRespository.create(
      transactions.map(({ title, type, value, category }) => ({
        title,
        type,
        value,
        category: finalCategories.find(
          finalCategory => finalCategory.title === category,
        ),
      })),
    );

    await transactionsRespository.save(createdTransactions);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
