// Temporary type fixes for build issues
declare global {
  namespace NodeJS {
    interface Process {
      setpriority?: (priority: number) => void;
    }
  }
}

export {};
