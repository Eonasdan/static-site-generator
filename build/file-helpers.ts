import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { SiteConfig } from './models/site-config';

const cp = promisify(require('fs'));

export class FileHelpers {
  static siteConfig: SiteConfig;

  static async removeDirectoryAsync(directory, removeSelf = true) {
    try {
      const files = (await fs.readdir(directory)) || [];
      for (const file of files) {
        const filePath = path.join(directory, file);
        if ((await fs.stat(filePath)).isFile())
          await FileHelpers.removeFileAsync(filePath);
        else await FileHelpers.removeDirectoryAsync(filePath);
      }
    } catch (e) {
      return;
    }
    if (removeSelf) await fs.rmdir(directory);
  }

  static async removeFileAsync(filePath) {
    if (!(await fs.stat(filePath)).isFile()) return;
    try {
      await fs.unlink(filePath);
    } catch (e) {}
  }

  static async copyFileAsync(filePath?: string, destination?: string) {
    //copy all
    if (!filePath) {
      await cp(
        `./${FileHelpers.siteConfig.source}/copy`,
        FileHelpers.siteConfig.output.main,
        { recursive: true }
      );
      return;
    }
    await fs.copyFile(filePath, destination);
  }

  static async writeFileAndEnsurePathExistsAsync(filePath, content) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    await fs.writeFile(filePath, content);
  }

  static async fileExists(file): Promise<boolean> {
    try {
      return !!(await fs.stat(file));
    } catch (err) {
      return false;
    }
  }
}
