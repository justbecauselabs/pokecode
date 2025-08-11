import { useMemo } from "react";
import {
	detectCodeLanguage,
	parseMessageContent,
} from "../utils/messageParser";

export function useMessageParser() {
	const parser = useMemo(
		() => ({
			parseMessageContent,
			detectCodeLanguage,
		}),
		[],
	);

	return parser;
}
