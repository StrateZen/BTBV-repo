import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildInitialData, ensureBootstrapUsers, migrateSeedData } from "./seed.mjs";

const COLLECTIONS = [
  "users",
  "clientProfiles",
  "rooms",
  "roomPhotos",
  "emotionEntries",
  "aiRecommendations",
  "emilyReviews",
  "tasks",
  "followUps",
  "roomScores",
  "ghlSyncLogs",
  "emailLogs",
  "assistantItems",
  "warranties",
  "freedomEntries",
  "communityPosts",
  "communityComments",
  "sessions",
  "portalTokens"
];

export class JsonStore {
  constructor(filePath = process.env.DATA_FILE || "data/db.json") {
    this.filePath = path.resolve(process.cwd(), filePath);
    this.data = null;
  }

  async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    let changed = false;
    try {
      this.data = JSON.parse(await readFile(this.filePath, "utf8"));
      const migration = migrateSeedData(this.data);
      this.data = migration.data;
      changed = migration.changed;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.data = buildInitialData();
      changed = true;
    }

    for (const collection of COLLECTIONS) {
      if (!Array.isArray(this.data[collection])) this.data[collection] = [];
    }

    changed = ensureBootstrapUsers(this.data) || changed;
    if (changed) await this.save();

    return this;
  }

  async save() {
    await writeFile(this.filePath, `${JSON.stringify(this.data, null, 2)}\n`);
  }

  all(collection) {
    return this.data[collection] || [];
  }

  find(collection, id) {
    return this.all(collection).find((record) => record.id === id) || null;
  }

  findBy(collection, predicate) {
    return this.all(collection).find(predicate) || null;
  }

  filter(collection, predicate) {
    return this.all(collection).filter(predicate);
  }

  async create(collection, values, prefix = singularPrefix(collection)) {
    const timestamp = new Date().toISOString();
    const record = {
      id: values.id || `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      ...values,
      created_at: values.created_at || timestamp,
      updated_at: values.updated_at || timestamp
    };

    this.data[collection].push(record);
    await this.save();
    return record;
  }

  async update(collection, id, values) {
    const index = this.data[collection].findIndex((record) => record.id === id);
    if (index === -1) return null;

    this.data[collection][index] = {
      ...this.data[collection][index],
      ...values,
      updated_at: new Date().toISOString()
    };
    await this.save();
    return this.data[collection][index];
  }

  async delete(collection, id) {
    const index = this.data[collection].findIndex((record) => record.id === id);
    if (index === -1) return null;
    const [record] = this.data[collection].splice(index, 1);
    await this.save();
    return record;
  }

  async upsertBy(collection, predicate, values, prefix) {
    const existing = this.findBy(collection, predicate);
    if (existing) return this.update(collection, existing.id, values);
    return this.create(collection, values, prefix);
  }
}

export async function createStore(filePath) {
  return new JsonStore(filePath).init();
}

function singularPrefix(collection) {
  return collection.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`).replace(/s$/, "");
}
