export type ParsedSseEvent = {
  event: string;
  data: string;
};

export const parseSse = (payload: string): ParsedSseEvent[] => {
  const blocks = payload.split("\n\n").map((block) => block.trim()).filter(Boolean);

  return blocks.map((block) => {
    const lines = block.split("\n");
    const eventLine = lines.find((line) => line.startsWith("event:"));
    const dataLine = lines.find((line) => line.startsWith("data:"));

    return {
      event: eventLine ? eventLine.replace("event:", "").trim() : "",
      data: dataLine ? dataLine.replace("data:", "").trim() : "",
    };
  });
};
