import sharp, {
    FlattenOptions, FormatEnum,
    NegateOptions,
    ResizeOptions,
    TileOptions,
    WriteableMetadata
} from 'sharp';
import * as path from 'path';
import Utilities from './utilities';
import {promises as fs} from 'fs';

export default class Images {

    async generateSourceSetAsync(config: ImageGenerateConfig, alt: string[] = []): Promise<PictureSet[]> {
        const pictureTags: PictureSet[] = [];
        const imageResult = await this.generateResponsiveImagesAsync(config);
        
        for (let i = 0; i < imageResult.length; i++){
            let responsiveImage = imageResult[i];
            let pictureTag = '<picture>\n';
            responsiveImage.sizedImages
                .sort((a, b) => a.size.width < b.size.width ? 1 : -1);

            const firstImage = responsiveImage.sizedImages[0];
            for (let j = 0; j < responsiveImage.sizedImages.length; j++) {
                const current = responsiveImage.sizedImages[j];
                pictureTag += `<source media="(min-width: ${current.size.width}px)" srcset="${config.sourceSetPath}/${current.file}"/>\n`;
                if (j + 1 >= responsiveImage.sizedImages.length) {
                    pictureTag += `<img src="${config.sourceSetPath}/${firstImage.file}" alt="${alt[i]}" height="${firstImage.size.height}" width="${firstImage.size.width}"/>\n`;
                    break;
                }
            }

            pictureTag += '</picture>';

            pictureTags.push({
                file: responsiveImage.file,
                pictureTag
            });
        }

        return pictureTags;
    }


    async generateResponsiveImagesAsync(config: ImageGenerateConfig): Promise<ResponsiveImages[]> {
        const files: ResponsiveImages[] = []
        config.sharpConfig = Images.mergeConfig(config.sharpConfig);

        if (config.imageRoot) {
            config.images.forEach((x, index) => config.images[index] = path.join(config.imageRoot, x));
        }

        for (const file of config.images) {
            const sizedImages: { file: string, size: Size }[] = [];
            for (let size of config.sizes) {
                sizedImages.push(await this.generateResponsiveImageAsync(file, size, config.destinationDirectory, config.sharpConfig));
            }
            files.push({
                file,
                sizedImages
            })
        }

        return files;
    }

    async generateResponsiveImageAsync(file: string, size: Size, destinationDirectory: string, sharpConfig: SharpConfig): Promise<{ file: string, size: Size }> {
        const msgPrefix = `File ${file}: `
        const image = sharp(file);

        const metadata = await image.metadata();

        let width, height, extract, toFormat = sharpConfig.format;

        if (!sharpConfig.format) {
            toFormat = Images.format(file)
        }

        width = Images.size(size.width, metadata.width);
        height = Images.size(size.height, metadata.height);

        if (width || height) {
            if (sharpConfig.resizeOptions.withoutEnlargement && (width > metadata.width || height > metadata.height)) {
                let message = `${msgPrefix} Image enlargement is detected`

                if (width) {
                    message += `\n  real width: ${metadata.width}px, required width: ${width}px`
                }

                if (height) {
                    message += `\n  real height: ${metadata.height}px, required height: ${height}px`
                }

                if (sharpConfig.errorOnEnlargement) {
                    throw Error(message)
                }
                if (sharpConfig.skipOnEnlargement) {
                    if (!sharpConfig.silent) {
                        Utilities.log(`(skip for processing)`, msgPrefix)
                    }

                    // passing a null file to the callback stops a new image being added to the pipeline for this sharpConfig
                    return null;
                }

                if (!sharpConfig.silent) {
                    Utilities.log(`(skip for enlargement)`, msgPrefix)
                }
            }
        }

        try {
            if (sharpConfig.extractBeforeResize) {
                extract = sharpConfig.extractBeforeResize
                image.extract({
                    top: extract.top,
                    left: extract.left,
                    width: extract.width,
                    height: extract.height
                })
            }

            image.resize(width, height, sharpConfig.resizeOptions);

            if (sharpConfig.extractAfterResize) {
                extract = sharpConfig.extractAfterResize
                image.extract({
                    top: extract.top,
                    left: extract.left,
                    width: extract.width,
                    height: extract.height
                });
            }

            if (sharpConfig.flatten) {
                image.flatten({
                    background: sharpConfig.resizeOptions.background
                });
            }
            
            if (sharpConfig.negate) {
                image.negate(sharpConfig.negate);
            }

            if (sharpConfig.rotate) {
                image.rotate(sharpConfig.rotate);
            }

            if (sharpConfig.flip) {
                image.flip(sharpConfig.flip);
            }
            
            if (sharpConfig.flop) {
                image.flop(sharpConfig.flop);
            }
            
            if (sharpConfig.blur) {
                image.blur(sharpConfig.blur);
            }

            if (sharpConfig.sharpen) {
                image.sharpen(sharpConfig.sharpen.sigma, sharpConfig.sharpen.flat, sharpConfig.sharpen.jagged);
            }

            if (sharpConfig.threshold) {
                image.threshold(sharpConfig.threshold);
            }

            if (sharpConfig.gamma) {
                image.gamma(sharpConfig.gamma);
            }

            if (sharpConfig.grayscale) {
                image.grayscale(sharpConfig.grayscale);
            }
            
            if (sharpConfig.normalize) {
                image.normalize(sharpConfig.normalize);
            }
            
            if (sharpConfig.withMetadata) {
                image.withMetadata(sharpConfig.withMetadata);
            }
            
            if (sharpConfig.tile) {
                image.tile(sharpConfig.tile);
            }

            image.toFormat(toFormat)
        } catch (err) {
            err.file = file
            throw Error(err)
        }

        const oldFileName = path.basename(file, path.extname(file));
        const newFileName = `${oldFileName}-${width}w.${toFormat}`;

        const newPath = path.join(destinationDirectory, newFileName);
        await fs.mkdir(path.dirname(newPath), {recursive: true});

        const info = await image.toFile(newPath);

        return {
            file: newFileName,
            size: {
                width: info.width,
                height: info.height
            }
        };
    }

    private static size(neededSize, originalSize): number {
        if (neededSize === undefined || neededSize === null) {
            return null
        }
        if (typeof neededSize === 'string' && neededSize.indexOf('%') > -1) {
            const percentage = parseFloat(neededSize);

            if (isNaN(percentage)) {
                throw new Error(`Wrong percentage size "${neededSize}"`);
            }

            return Math.round(originalSize * percentage * 0.01);
        }

        neededSize = parseInt(neededSize);

        if (isNaN(neededSize)) {
            throw new Error(`Wrong size "${neededSize}"`);
        }

        return neededSize
    }

    private static format(filePath): keyof FormatEnum {
        const extname = path.extname(filePath);

        switch (extname) {
            case '.jpeg':
            case '.jpg':
            case '.jpe':
                return 'jpeg';
            case '.avif':
                return 'avif';
            case '.dz':
                return 'dz';
            case '.fits':
                return 'fits';
            case '.gif':
                return 'gif';
            case '.heif':
                return 'heif';
            case '.input':
                return 'input';
            case '.magick':
                return 'magick';
            case '.openslide':
                return 'openslide';
            case '.pdf':
                return 'pdf';
            case '.png':
                return 'png';
            case '.ppm':
                return 'ppm';
            case '.raw':
                return 'raw';
            case '.svg':
                return 'svg';
            case '.tiff':
                return 'tiff';
            case '.tif':
                return 'tif';
            case '.v':
                return 'v';
            case '.webp':
                return 'webp';
            default:
                throw new Error('Unsupported file type');
        }
    }

    private static mergeConfig(config: SharpConfig) {
        const defaultConfig: SharpConfig = {
            resizeOptions: {
                kernel: 'lanczos3'
            },
            quality: 80,
            compressionLevel: 6,
            format: 'webp',
            skipOnEnlargement: true
        };

        return Object.assign({}, defaultConfig, config);
    }
}

export const defaultSizes: Size[] = [
    {width: '376'},
    {width: '576'},
    {width: '768'},
    {width: '992'},
    {width: '1200'}
]

export interface ImageGenerateConfig {
    sizes: Size[];
    images: string[];
    imageRoot?: string;
    destinationDirectory: string;
    sharpConfig?: SharpConfig;
    sourceSetPath: string;
}

export interface SharpConfig {
    resizeOptions?: ResizeOptions;
    skipOnEnlargement?: boolean;
    silent?: boolean;
    errorOnEnlargement?: boolean;
    extractBeforeResize?: Square;
    extractAfterResize?: Square;
    flatten?: boolean | FlattenOptions;
    negate?: boolean | NegateOptions;
    rotate?: number;
    flip?: boolean;
    flop?: boolean;
    blur?: number | boolean;
    sharpen?: {
        sigma?: number;
        flat?: number;
        jagged?: number;
    },
    threshold?: number;
    gamma?: number;
    grayscale?: boolean;
    normalize?: boolean;
    quality: number;
    progressive?: boolean;
    withMetadata?: WriteableMetadata;
    tile?: TileOptions;
    compressionLevel: number;
    format?: keyof FormatEnum;
}

export type Size = {
    width: number | string;
    height?: number | string;
}

export type Square = {
    top: number;
    left: number;
    width: number;
    height: number;
}

export type ResponsiveImages = {
    file: string,
    sizedImages: {
        file: string;
        size: Size;
    }[]
}

export type PictureSet = {
    file: string;
    pictureTag: string;
}
