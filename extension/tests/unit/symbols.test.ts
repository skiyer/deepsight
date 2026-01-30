import { describe, expect, it } from "vitest";
import { extractSymbolName } from "../../src/utils/symbols";

describe("extractSymbolName", () => {
  it("extracts JS/TS function and class names", () => {
    expect(extractSymbolName("function doThing() {}"))
      .toBe("doThing");
    expect(extractSymbolName("class FancyService {}"))
      .toBe("FancyService");
    expect(extractSymbolName("const handler = () => {}"))
      .toBe("handler");
  });

  it("extracts Python symbols", () => {
    expect(extractSymbolName("def process_data(x):"))
      .toBe("process_data");
    expect(extractSymbolName("class DataStore:"))
      .toBe("DataStore");
  });

  it("extracts Go/Rust symbols", () => {
    expect(extractSymbolName("func (s *Store) Save()"))
      .toBe("Save");
    expect(extractSymbolName("fn compute(value: i32) -> i32"))
      .toBe("compute");
  });

  it("extracts C++ style symbols", () => {
    expect(extractSymbolName("static inline int do_work(int x)"))
      .toBe("do_work");
  });

  it("returns null when no symbol is found", () => {
    expect(extractSymbolName("// just a comment")).toBeNull();
  });
});
