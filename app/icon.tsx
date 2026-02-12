import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          display: "flex",
          fontSize: 26,
          height: "100%",
          justifyContent: "center",
          width: "100%",
          background: "#ffffff",
        }}
      >
        {"➗"}
      </div>
    ),
    {
      ...size,
    }
  );
}
