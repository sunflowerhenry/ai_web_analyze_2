import "@/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";

export const metadata: Metadata = {
	title: "AI 网站内容分析系统",
	description: "智能爬取网站内容并通过AI进行客户分析",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`${geist.variable}`}>
			<body>
				{children}
				<Toaster 
					position="top-center" 
					richColors 
					expand={true}
					duration={3000}
					closeButton={true}
				/>
			</body>
		</html>
	);
}
