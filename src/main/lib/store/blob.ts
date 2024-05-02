/**
 * Blob storage manages all non structured data.
 * This includes silly tavern cards, images, audio, base weights, lora adapters, and other binary data.
 */

// FIXME: Add proper transaction handling with support for rolling back *any* state as well as db state.
// Ex: rollback file creation, db insertions, etc.
// Wrap better-sqlite3

import {Result,  CardBundleWithoutID, CardData } from "@shared/types";
import { isError, isValidFileName, toPathEscapedStr } from "@shared/utils";
import archiver from "archiver";
import crypto from "crypto";
import { app, dialog, nativeImage } from "electron";
import fs from "fs";
import fsp from "fs/promises";
import JSZip from "jszip";
import path from "path";
import {
  attainable,
  blobRootPath,
  cardsRootPath,
  copyFolder,
  extractZipToDir,
  unpackedPath
} from "../utils";
import sqlite from "./sqlite";

async function init() {
  const blobDirExists = await attainable(blobRootPath);
  if (!blobDirExists) {
    await fsp.mkdir(blobRootPath);
  }

  const cardsDirExists = await attainable(cardsRootPath);
  // Copy unpackedPath/blob/cards to cardsRootPath
  if (!cardsDirExists) {
    await fsp.mkdir(cardsRootPath);
    copyFolder(path.join(unpackedPath, "blob/cards"), cardsRootPath);
  }
}

/**
 * Retrieves an image from the specified path.
 * @param path - The path to the image file.
 * @returns A promise that resolves to a Result object containing the image or an error.
 */
export namespace image {
  export async function get(path: string): Promise<Result<any, Error>> {
    const image = nativeImage.createFromPath(path);
    return { kind: "ok", value: image };
  }
}

// =====================================================================
// Cards Blob Storage
// =====================================================================
export namespace cards {
  /**
   * Gets card data under the appData/blob/cards directory given a card dir name.
   *
   * Looks for a directory with the given name in the cardsPath.
   * The following files are expected to be in the directory:
   * - card.json
   * - avatar.png
   * - banner.png
   *
   * @param name The name of the card directory to get.
   * @returns A result object containing the CardResources if successful, else error.
   *
   */
  export async function get(name: string): Promise<Result<CardBundleWithoutID, Error>> {
    const dirPath = path.join(cardsRootPath, name);
    if (!(await attainable(dirPath))) {
      return { kind: "err", error: new Error(`Card folder "${name}" not found`) };
    }

    const dataFilePath = path.join(dirPath, "data.json");
    if (!(await attainable(dataFilePath))) {
      return { kind: "err", error: new Error(`data.json not found in "${name}" folder`) };
    }

    let data;
    try {
      data = JSON.parse(await fsp.readFile(dataFilePath, "utf8"));
    } catch (e) {
      isError(e);
      return { kind: "err", error: e };
    }

    // TODO: Promise.all() to fetch both URIs asynchronously
    const uriPrefix = "realive:///cards/";
    const avatarFilePath = path.join(dirPath, "avatar.png");
    const avatarFileExists = await attainable(avatarFilePath);
    const avatarURI = avatarFileExists ? uriPrefix + name + "/avatar.png" : "";
    const bannerFilePath = path.join(dirPath, "banner.png");
    const bannerFileExists = await attainable(bannerFilePath);
    const bannerURI = bannerFileExists ? uriPrefix + name + "/banner.png" : "";

    return {
      kind: "ok",
      value: {
        data: data,
        avatarURI,
        bannerURI
      }
    };
  }

  /**
   * Posts a card to the storage.
   * @param cardData - The data of the card to be posted.
   * @param bannerURI - The path to the banner image, or null if no banner image is provided.
   * @param avatarURI - The path to the avatar image, or null if no avatar image is provided.
   * @returns A promise that resolves to a Result object indicating the success or failure of the operation.
   */
  export async function create(
    cardData: CardData,
    bannerURI: string | null,
    avatarURI: string | null
  ): Promise<Result<undefined, Error>> {
    const pathEscapedCharName = toPathEscapedStr(cardData.character.name);
    const cardDirName = `${pathEscapedCharName}-${crypto.randomUUID()}`;
    const cardDirPath = path.join(cardsRootPath, cardDirName);

    await fsp.mkdir(cardDirPath, { recursive: true });

    await fsp.writeFile(path.join(cardDirPath, "data.json"), JSON.stringify(cardData));

    if (avatarURI) {
      await fsp.copyFile(avatarURI, path.join(cardDirPath, "avatar.png"));
    }
    if (bannerURI) {
      await fsp.copyFile(bannerURI, path.join(cardDirPath, "banner.png"));
    }

    // Insert an entry for the card into the database
    try {
      const query = `INSERT INTO cards (dir_name) VALUES (?);`;
      sqlite.run(query, [cardDirName]);

      return { kind: "ok", value: undefined };
    } catch (e) {
      // Roll back on error
      await fsp.rm(cardDirPath, { recursive: true });
      return { kind: "err", error: e };
    }
  }

  /**
   * Updates the card data and images in the card directory.
   * @param cardID - The ID of the card to update.
   * @param cardData - The updated card data.
   * @param bannerURI - The new banner image, or null if not provided.
   * @param avatarURI - The new avatar image, or null if not provided.
   * @returns A promise that resolves to a Result object indicating the success or failure of the update operation.
   */
  export async function update(
    cardID: number,
    cardData: CardData,
    bannerURI: string | null,
    avatarURI: string | null
  ): Promise<Result<undefined, Error>> {
    // Retrieve the dir_name of the card from the database using the id
    const query = `SELECT dir_name FROM cards WHERE id =?;`;
    const row = (await sqlite.get(query, [cardID])) as { dir_name: string };

    // Construct the path to the card directory
    const cardDirPath = path.join(cardsRootPath, row.dir_name);

    // Write the updated card data to the data.json file
    await fsp.writeFile(path.join(cardDirPath, "data.json"), JSON.stringify(cardData));

    // If a new avatar image is provided, copy it to the card directory
    if (avatarURI) {
      await fsp.copyFile(avatarURI, path.join(cardDirPath, "avatar.png"));
    }

    // If a new banner image is provided, copy it to the card directory
    if (bannerURI) {
      await fsp.copyFile(bannerURI, path.join(cardDirPath, "banner.png"));
    }

    return { kind: "ok", value: undefined };
  }

  export async function del(cardID: number): Promise<Result<undefined, Error>> {
    // Retrieve the dir_name of the card from the database using the id
    const query = `SELECT dir_name FROM cards WHERE id =?;`;
    const row = (await sqlite.get(query, [cardID])) as { dir_name: string };

    // Construct the path to the card directory
    const cardDirPath = path.join(cardsRootPath, row.dir_name);

    try {
      // Delete the card directory
      await fs.promises.rm(cardDirPath, { recursive: true });

      return { kind: "ok", value: undefined };
    } catch (error) {
      return { kind: "err", error: error };
    }
  }

  /**
   * Given a card directory name, zips the directory, and display a save dialog to save the zip file.
   * @param name The name of the card directory to export
   * @returns A void Result object
   */
  export async function exportToZip(name: string): Promise<Result<void, Error>> {
    const cardDirPath = path.join(cardsRootPath, name);
    if (!(await attainable(cardDirPath))) {
      return { kind: "err", error: new Error(`Card folder "${name}" not found`) };
    }

    // Show user a dialog to select the save location
    const dialogDefaultPath = path.join(app.getPath("desktop"), `${name}.zip`);
    const zipFilePath = await dialog.showSaveDialog({
      defaultPath: dialogDefaultPath,
      filters: [{ name: "Zip Files", extensions: ["zip"] }]
    });

    if (zipFilePath.canceled || !zipFilePath.filePath) {
      return { kind: "err", error: new Error("Export canceled by user.") };
    }

    // Zip up the card directory
    try {
      const output = fs.createWriteStream(zipFilePath.filePath);
      const archive = archiver("zip", {
        zlib: { level: 5 }
      });
      archive.pipe(output);
      archive.directory(cardDirPath, false);
      await archive.finalize();
      return { kind: "ok", value: undefined };
    } catch (e) {
      return { kind: "err", error: e };
    }
  }

  /**
   * Validates the contents of a zip file and extracts the card's data.json
   *
   * @param zip - The path to the zip file containing the card data.
   * @returns A `Result` containing the parsed card data or an error if the zip file is invalid.
   */
  async function _validateAndGetCardData(zip: string): Promise<Result<CardData, Error>> {
    const zipData = await fs.promises.readFile(zip);
    const jszip = await JSZip.loadAsync(zipData);

    // Validates that the zip contains a data.json
    const dataJSONFile = jszip.file("data.json");
    if (!dataJSONFile) {
      return { kind: "err", error: new Error("data.json not found in card's zip") };
    }

    // Validates that data.json is valid JSON
    const dataJSONContent = await dataJSONFile.async("string");
    let parsedData: CardData;
    try {
      parsedData = JSON.parse(dataJSONContent);
    } catch (e) {
      return { kind: "err", error: new Error("data.json is not valid JSON and could not be parsed.") };
    }

    // Validates that the data.json conforms to the reAlive spec
    if (parsedData.spec !== "reAlive") {
      return { kind: "err", error: new Error("data.json card spec is not conformant to reAlive.") };
    }
    return { kind: "ok", value: parsedData };
  }

  /**
   * Imports a card from a zip file and inserts it into the database.
   *
   * @param zip - The path to the zip file containing the card data.
   * @returns A `Result` object indicating success or failure, and an optional error.
   */
  export async function importFromZip(zip: string): Promise<Result<void, Error>> {
    if (!(await attainable(zip))) {
      return { kind: "err", error: new Error(`Zip file "${zip}" not accessible.`) };
    }

    const validateRes = await _validateAndGetCardData(zip);
    if (validateRes.kind === "err") {
      return validateRes;
    }

    // Validate the character name
    const charName = validateRes.value.character.name;
    if (!isValidFileName(charName)) {
      return {
        kind: "err",
        error: new Error(
          `Character name "${charName}" is invalid. Names must only include alphanumeric symbols, spaces, and hyphens.`
        )
      };
    }

    const pathEscapedCharName = toPathEscapedStr(charName);
    const cardDirName = `${pathEscapedCharName}-${crypto.randomUUID()}`;
    const cardDirPath = path.join(cardsRootPath, cardDirName);

    // Extract the zip to the card directory
    await fsp.mkdir(cardDirPath);
    const extractRes = await extractZipToDir(zip, cardDirPath);
    if (extractRes.kind === "err") {
      return extractRes;
    }

    // Insert an entry for the card into the database
    try {
      const query = `INSERT INTO cards (dir_name) VALUES (?);`;
      sqlite.run(query, [cardDirName]);
      return { kind: "ok", value: undefined };
    } catch (e) {
      // Roll back on error
      await fsp.rm(cardDirPath, { recursive: true });
      return { kind: "err", error: e };
    }
  }
}



export default {
  init,
  image,
  cards
};
