package service

import (
	"context"
	"errors"
	"log/slog"
	"net/url"
	"slices"
	"strings"
	"unicode/utf8"

	"connectrpc.com/connect"
	pb "github.com/gocloudio/link-hub/backend/gen/linkhub/v1"
	"github.com/gocloudio/link-hub/backend/internal/auth"
	"github.com/gocloudio/link-hub/backend/internal/logging"
	"github.com/gocloudio/link-hub/backend/internal/store"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type Service struct{ Store *store.Store }

func invalid(message string) error {
	return connect.NewError(connect.CodeInvalidArgument, errors.New(message))
}
func validateID(id string) error {
	if uuid.Validate(id) != nil {
		return invalid("记录 ID 格式错误")
	}
	return nil
}
func validateName(name string, limit int) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > limit || strings.ContainsAny(name, "\r\n\x00") {
		return "", invalid("名称不能为空、不能换行，且不能超过字段长度限制")
	}
	return name, nil
}
func validateCard(input *pb.CardInput) (store.Card, error) {
	if input == nil {
		return store.Card{}, invalid("缺少卡片内容")
	}
	name, err := validateName(input.Name, 80)
	if err != nil {
		return store.Card{}, err
	}
	address := strings.TrimSpace(input.Url)
	u, err := url.Parse(address)
	if err != nil || u.Hostname() == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || len(address) > 2048 || strings.ContainsAny(address, "\r\n\x00") {
		return store.Card{}, invalid("链接必须为完整的 HTTP/HTTPS 地址，不能包含账号密码，最长 2048 字节")
	}
	if utf8.RuneCountInString(input.DescriptionMarkdown) > 50000 || strings.ContainsRune(input.DescriptionMarkdown, '\x00') {
		return store.Card{}, invalid("描述不能超过 50000 字，不能包含空字符")
	}
	ids := slices.Clone(input.CategoryIds)
	if len(ids) == 0 || len(ids) > 100 {
		return store.Card{}, invalid("请至少选择一个分类，最多 100 个")
	}
	for _, id := range ids {
		if err = validateID(id); err != nil {
			return store.Card{}, err
		}
	}
	slices.Sort(ids)
	ids = slices.Compact(ids)
	if len(input.SharedUserIds) > 100 {
		return store.Card{}, invalid("最多分享给 100 位成员")
	}
	shared := slices.Clone(input.SharedUserIds)
	for _, id := range shared {
		if err := validateID(id); err != nil {
			return store.Card{}, err
		}
	}
	slices.Sort(shared)
	shared = slices.Compact(shared)
	if !input.IsPrivate && len(shared) > 0 {
		return store.Card{}, invalid("内部公开卡片无需指定分享对象")
	}
	return store.Card{Name: name, URL: address, Description: strings.TrimSpace(input.DescriptionMarkdown), CategoryIDs: ids, IsPrivate: input.IsPrivate, SharedUserIDs: shared}, nil
}
func actorFromContext(ctx context.Context) store.Actor {
	p, _ := auth.FromContext(ctx)
	return store.Actor{ID: p.ID, IsAdmin: p.IsAdmin}
}
func cardProto(c store.Card, actor store.Actor) *pb.Card {
	canEdit := actor.IsAdmin || (c.IsPrivate && c.OwnerID == actor.ID)
	var shared []string
	if canEdit {
		shared = c.SharedUserIDs
	}
	return &pb.Card{Id: c.ID, Name: c.Name, DescriptionMarkdown: c.Description, Url: c.URL, CategoryIds: c.CategoryIDs,
		CreatedAt: timestamppb.New(c.CreatedAt), UpdatedAt: timestamppb.New(c.UpdatedAt), IsPrivate: c.IsPrivate,
		OwnerId: c.OwnerID, SharedUserIds: shared, CanEdit: canEdit}
}
func categoryProto(c store.Category) *pb.Category {
	return &pb.Category{Id: c.ID, Name: c.Name, CardCount: c.CardCount}
}
func rpcError(err error) error {
	if err == nil {
		return nil
	}
	code := connect.CodeInternal
	message := "暂时无法完成操作，请重试"
	switch {
	case errors.Is(err, store.ErrForbidden):
		code = connect.CodePermissionDenied
		message = err.Error()
	case errors.Is(err, store.ErrNotFound):
		code = connect.CodeNotFound
		message = err.Error()
	case errors.Is(err, store.ErrInUse):
		code = connect.CodeFailedPrecondition
		message = err.Error()
	case errors.Is(err, store.ErrConflict):
		code = connect.CodeAborted
		message = err.Error()
	case errors.Is(err, context.DeadlineExceeded):
		code = connect.CodeDeadlineExceeded
		message = "请求超时，请重试"
	case errors.Is(err, context.Canceled):
		code = connect.CodeCanceled
		message = "请求已取消"
	default:
		var pg *pgconn.PgError
		if errors.As(err, &pg) {
			switch pg.Code {
			case "23505":
				code = connect.CodeAlreadyExists
				message = "该分类名称已存在"
			case "23503":
				code = connect.CodeFailedPrecondition
				message = "分类或分享对象已变更，或分类仍有关联卡片，请刷新后重试"
			case "23514":
				code = connect.CodeInvalidArgument
				message = "内容不符合规则，每张卡片必须至少选择一个分类"
			case "40001", "40P01":
				code = connect.CodeAborted
				message = "其他管理员正在修改相关内容，请重试"
			}
		}
	}
	if code == connect.CodeInternal {
		slog.Error("数据库操作失败", "error_type", logging.ErrorKind(err))
	}
	return connect.NewError(code, errors.New(message))
}

func (s *Service) ListCategories(ctx context.Context, _ *connect.Request[pb.ListCategoriesRequest]) (*connect.Response[pb.ListCategoriesResponse], error) {
	list, err := s.Store.ListCategories(ctx, actorFromContext(ctx))
	if err != nil {
		return nil, rpcError(err)
	}
	out := &pb.ListCategoriesResponse{}
	for _, c := range list {
		out.Categories = append(out.Categories, categoryProto(c))
	}
	return connect.NewResponse(out), nil
}
func (s *Service) ListCards(ctx context.Context, req *connect.Request[pb.ListCardsRequest]) (*connect.Response[pb.ListCardsResponse], error) {
	if req.Msg.CategoryId != "" {
		if err := validateID(req.Msg.CategoryId); err != nil {
			return nil, err
		}
	}
	list, err := s.Store.ListCards(ctx, req.Msg.CategoryId, actorFromContext(ctx))
	if err != nil {
		return nil, rpcError(err)
	}
	out := &pb.ListCardsResponse{}
	for _, c := range list {
		out.Cards = append(out.Cards, cardProto(c, actorFromContext(ctx)))
	}
	return connect.NewResponse(out), nil
}
func (s *Service) GetCard(ctx context.Context, req *connect.Request[pb.GetCardRequest]) (*connect.Response[pb.GetCardResponse], error) {
	if err := validateID(req.Msg.Id); err != nil {
		return nil, err
	}
	c, err := s.Store.GetCard(ctx, req.Msg.Id, actorFromContext(ctx))
	if err != nil {
		return nil, rpcError(err)
	}
	return connect.NewResponse(&pb.GetCardResponse{Card: cardProto(c, actorFromContext(ctx))}), nil
}
func (s *Service) GetMe(ctx context.Context, _ *connect.Request[pb.GetMeRequest]) (*connect.Response[pb.GetMeResponse], error) {
	p, ok := auth.FromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, auth.ErrInvalidToken)
	}
	if err := s.Store.RecordMember(ctx, store.Member{ID: p.ID, Name: p.Name, Username: p.Username}); err != nil {
		return nil, rpcError(err)
	}
	return connect.NewResponse(&pb.GetMeResponse{Id: p.ID, Name: p.Name, Username: p.Username, IsAdmin: p.IsAdmin}), nil
}
func (s *Service) CreateCard(ctx context.Context, req *connect.Request[pb.CreateCardRequest]) (*connect.Response[pb.CreateCardResponse], error) {
	if !actorFromContext(ctx).IsAdmin && !req.Msg.Card.GetIsPrivate() {
		return nil, rpcError(store.ErrForbidden)
	}
	c, err := validateCard(req.Msg.Card)
	if err != nil {
		return nil, err
	}
	c, err = s.Store.SaveCard(ctx, c, nil, actorFromContext(ctx))
	if err != nil {
		return nil, rpcError(err)
	}
	return connect.NewResponse(&pb.CreateCardResponse{Card: cardProto(c, actorFromContext(ctx))}), nil
}
func (s *Service) UpdateCard(ctx context.Context, req *connect.Request[pb.UpdateCardRequest]) (*connect.Response[pb.UpdateCardResponse], error) {
	if !actorFromContext(ctx).IsAdmin && !req.Msg.Card.GetIsPrivate() {
		return nil, rpcError(store.ErrForbidden)
	}
	if err := validateID(req.Msg.Id); err != nil {
		return nil, err
	}
	if req.Msg.ExpectedUpdatedAt == nil || req.Msg.ExpectedUpdatedAt.CheckValid() != nil {
		return nil, invalid("缺少有效的修改版本，请重新加载卡片")
	}
	c, err := validateCard(req.Msg.Card)
	if err != nil {
		return nil, err
	}
	c.ID = req.Msg.Id
	expected := req.Msg.ExpectedUpdatedAt.AsTime()
	c, err = s.Store.SaveCard(ctx, c, &expected, actorFromContext(ctx))
	if err != nil {
		return nil, rpcError(err)
	}
	return connect.NewResponse(&pb.UpdateCardResponse{Card: cardProto(c, actorFromContext(ctx))}), nil
}
func (s *Service) DeleteCard(ctx context.Context, req *connect.Request[pb.DeleteCardRequest]) (*connect.Response[pb.DeleteCardResponse], error) {
	if err := validateID(req.Msg.Id); err != nil {
		return nil, err
	}
	if err := s.Store.DeleteCard(ctx, req.Msg.Id, actorFromContext(ctx)); err != nil {
		return nil, rpcError(err)
	}
	return connect.NewResponse(&pb.DeleteCardResponse{}), nil
}
func (s *Service) CreateCategory(ctx context.Context, req *connect.Request[pb.CreateCategoryRequest]) (*connect.Response[pb.CreateCategoryResponse], error) {
	name, err := validateName(req.Msg.Name, 24)
	if err != nil {
		return nil, err
	}
	c, err := s.Store.SaveCategory(ctx, "", name)
	if err != nil {
		return nil, rpcError(err)
	}
	return connect.NewResponse(&pb.CreateCategoryResponse{Category: categoryProto(c)}), nil
}
func (s *Service) UpdateCategory(ctx context.Context, req *connect.Request[pb.UpdateCategoryRequest]) (*connect.Response[pb.UpdateCategoryResponse], error) {
	if err := validateID(req.Msg.Id); err != nil {
		return nil, err
	}
	name, err := validateName(req.Msg.Name, 24)
	if err != nil {
		return nil, err
	}
	c, err := s.Store.SaveCategory(ctx, req.Msg.Id, name)
	if err != nil {
		return nil, rpcError(err)
	}
	return connect.NewResponse(&pb.UpdateCategoryResponse{Category: categoryProto(c)}), nil
}
func (s *Service) DeleteCategory(ctx context.Context, req *connect.Request[pb.DeleteCategoryRequest]) (*connect.Response[pb.DeleteCategoryResponse], error) {
	if err := validateID(req.Msg.Id); err != nil {
		return nil, err
	}
	if err := s.Store.DeleteCategory(ctx, req.Msg.Id); err != nil {
		return nil, rpcError(err)
	}
	return connect.NewResponse(&pb.DeleteCategoryResponse{}), nil
}
