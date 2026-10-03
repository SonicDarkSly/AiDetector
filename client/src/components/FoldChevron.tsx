import { RightOutlined } from '@ant-design/icons';

export function FoldChevron({ folded }: { folded: boolean }) {
  return <RightOutlined className={folded ? 'fold-chevron' : 'fold-chevron open'} />;
}
