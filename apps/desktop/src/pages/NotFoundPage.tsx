import { Link } from "@tanstack/react-router";

import { EmptyState } from "../components/ui";

export function NotFoundPage() {
  return (
    <section className="page">
      <EmptyState title="页面不存在" description="请求的启动器页面或插件入口不存在。" action={<Link className="button-link button-link--primary" to="/">返回概览</Link>} />
    </section>
  );
}
