process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://civicflow:civicflow@localhost:5432/civicflow_test?schema=public";
process.env.APP_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.CIVICFLOW_MODE = "demo";
process.env.LOCAL_STORAGE_DIR = "./storage/test-uploads";
process.env.RUN_INLINE_WORKER = "false";
