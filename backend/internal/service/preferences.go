package service

import (
	"context"

	"connectrpc.com/connect"
	pb "github.com/gocloudio/link-hub/backend/gen/linkhub/v1"
	"github.com/gocloudio/link-hub/backend/internal/auth"
)

func (s *Service) GetCardPreferences(ctx context.Context, _ *connect.Request[pb.GetCardPreferencesRequest]) (*connect.Response[pb.GetCardPreferencesResponse], error) {
	_, ok := auth.FromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, auth.ErrInvalidToken)
	}
	preferences, err := s.Store.GetCardPreferences(ctx, actorFromContext(ctx))
	if err != nil {
		return nil, rpcError(err)
	}
	return connect.NewResponse(&pb.GetCardPreferencesResponse{FavoriteCardIds: preferences.FavoriteCardIDs, OrderedCardIds: preferences.OrderedCardIDs}), nil
}

func (s *Service) SetCardFavorite(ctx context.Context, req *connect.Request[pb.SetCardFavoriteRequest]) (*connect.Response[pb.SetCardFavoriteResponse], error) {
	_, ok := auth.FromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, auth.ErrInvalidToken)
	}
	if err := validateID(req.Msg.CardId); err != nil {
		return nil, err
	}
	if err := s.Store.SetCardFavorite(ctx, actorFromContext(ctx), req.Msg.CardId, req.Msg.Favorite); err != nil {
		return nil, rpcError(err)
	}
	return connect.NewResponse(&pb.SetCardFavoriteResponse{}), nil
}

func (s *Service) SaveCardOrder(ctx context.Context, req *connect.Request[pb.SaveCardOrderRequest]) (*connect.Response[pb.SaveCardOrderResponse], error) {
	_, ok := auth.FromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, auth.ErrInvalidToken)
	}
	if len(req.Msg.CardIds) > 2000 {
		return nil, invalid("最多保存 2000 张卡片的顺序")
	}
	seen := make(map[string]bool, len(req.Msg.CardIds))
	for _, id := range req.Msg.CardIds {
		if err := validateID(id); err != nil {
			return nil, err
		}
		if seen[id] {
			return nil, invalid("排序中不能包含重复卡片")
		}
		seen[id] = true
	}
	if err := s.Store.SaveCardOrder(ctx, actorFromContext(ctx), req.Msg.CardIds); err != nil {
		return nil, rpcError(err)
	}
	return connect.NewResponse(&pb.SaveCardOrderResponse{}), nil
}

func (s *Service) ListMembers(ctx context.Context, _ *connect.Request[pb.ListMembersRequest]) (*connect.Response[pb.ListMembersResponse], error) {
	members, err := s.Store.ListMembers(ctx)
	if err != nil {
		return nil, rpcError(err)
	}
	out := &pb.ListMembersResponse{}
	for _, m := range members {
		out.Members = append(out.Members, &pb.Member{Id: m.ID, Name: m.Name, Username: m.Username})
	}
	return connect.NewResponse(out), nil
}
